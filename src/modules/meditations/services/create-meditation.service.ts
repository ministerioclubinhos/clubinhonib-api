import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppConflictException,
  AppException,
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { MeditationRepository } from '../repositories/meditation.repository';
import { CreateMeditationDto } from '../dto/create-meditation.dto';
import { MeditationResponseDto } from '../dto/meditation-response.dto';
import { MeditationEntity } from '../entities/meditation.entity';
import { toMeditationResponse } from '../mappers';
import { assertMeditationPeriod, parseDateAsLocal } from '../utils';
import {
  MEDITATION_ENTITY_TYPE,
  MEDITATION_ROUTE_IMAGE_URL,
  MEDITATION_ROUTE_PATH_PREFIX,
} from '../constants';

@Injectable()
export class CreateMeditationService {
  private readonly logger = new Logger(CreateMeditationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly meditationRepo: MeditationRepository,
    private readonly s3Service: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async create(
    dto: CreateMeditationDto,
    file?: Express.Multer.File,
  ): Promise<MeditationResponseDto> {
    assertMeditationPeriod({
      startDate: parseDateAsLocal(dto.startDate),
      endDate: parseDateAsLocal(dto.endDate),
    });

    await this.assertNoOverlap(dto.startDate, dto.endDate);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedMeditation: MeditationEntity | null = null;
    let savedMedia: MediaItemEntity | null = null;

    // Cada arquivo enviado fica registrado: se a criação falhar depois do
    // upload, o objeto é apagado do bucket em vez de ficar órfão.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.s3Service.upload(file),
    );

    try {
      savedMeditation = await this.meditationRepo.createMeditation(
        {
          topic: dto.topic,
          startDate: dto.startDate,
          endDate: dto.endDate,
        },
        dto.days,
        queryRunner.manager,
      );

      await this.createRoute(dto, savedMeditation, queryRunner.manager);
      savedMedia = await this.persistMedia(
        dto.media,
        savedMeditation.id,
        uploads,
        file,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Meditação criada. ID=${savedMeditation.id}`);

      return toMeditationResponse(savedMeditation, savedMedia);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      await this.discardOrphanMedia(savedMeditation?.id);
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3Service.delete(url),
      );

      this.logger.error(
        'Erro ao criar meditação. Rollback executado.',
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro inesperado ao criar meditação.',
        error as Error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /** Duas meditações não podem cobrir a mesma semana. */
  private async assertNoOverlap(
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.meditationRepo.findOverlapping(
      startDate,
      endDate,
      excludeId,
    );

    if (conflict) {
      throw new AppConflictException(
        ErrorCode.RESOURCE_CONFLICT,
        'Conflito com datas de uma meditação existente.',
      );
    }
  }

  private async createRoute(
    dto: CreateMeditationDto,
    meditation: MeditationEntity,
    manager: EntityManager,
  ): Promise<void> {
    const path = await this.routeService.generateAvailablePath(
      dto.topic,
      MEDITATION_ROUTE_PATH_PREFIX,
    );

    await this.routeService.createRouteWithManager(manager, {
      title: meditation.topic,
      subtitle: '',
      description: `Meditação semanal de ${dto.startDate} a ${dto.endDate}`,
      path,
      idToFetch: meditation.id,
      entityId: meditation.id,
      entityType: MEDITATION_ENTITY_TYPE,
      type: RouteType.DOC,
      image: MEDITATION_ROUTE_IMAGE_URL,
      public: false,
    });
  }

  private async persistMedia(
    media: MediaItemDto,
    meditationId: string,
    uploads: S3UploadTracker,
    file?: Express.Multer.File,
  ): Promise<MediaItemEntity> {
    let url = media.url?.trim() ?? '';
    let originalName = media.originalName;
    let size = media.size;

    if (media.isLocalFile) {
      if (!file) {
        throw new AppValidationException(
          ErrorCode.FILE_REQUIRED,
          'Arquivo não enviado.',
        );
      }

      url = await uploads.upload(file);
      originalName = file.originalname;
      size = file.size;
    }

    const entity = this.mediaItemProcessor.buildBaseMediaItem(
      {
        title: media.title,
        description: media.description,
        mediaType: media.mediaType,
        uploadType: media.uploadType,
        platformType: media.isLocalFile ? null : media.platformType,
        isLocalFile: media.isLocalFile,
        url,
        originalName,
        size,
      },
      meditationId,
      MEDITATION_ENTITY_TYPE,
    );

    return this.mediaItemProcessor.saveMediaItem(entity);
  }

  /**
   * A mídia é gravada fora da transação da meditação: no rollback, apagar o que
   * já tiver sido persistido evita registro e arquivo órfãos.
   */
  private async discardOrphanMedia(meditationId?: string): Promise<void> {
    if (!meditationId) return;

    try {
      const orphans = await this.mediaItemProcessor.findMediaItemsByTarget(
        meditationId,
        MEDITATION_ENTITY_TYPE,
      );
      if (orphans.length === 0) return;

      await this.mediaItemProcessor.deleteMediaItems(orphans, (url: string) =>
        this.s3Service.delete(url),
      );
      this.logger.warn(
        `Compensação executada: ${orphans.length} mídia(s) órfã(s) removida(s). meditationId=${meditationId}`,
      );
    } catch (cleanupError: unknown) {
      this.logger.error(
        `Falha ao remover mídias órfãs da meditação ${meditationId}`,
        cleanupError instanceof Error ? cleanupError.stack : undefined,
      );
    }
  }
}
