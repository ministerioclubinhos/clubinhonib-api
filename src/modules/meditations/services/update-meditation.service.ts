import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AppConflictException,
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { MeditationRepository } from '../repositories/meditation.repository';
import { UpdateMeditationDto } from '../dto/update-meditation.dto';
import { MeditationResponseDto } from '../dto/meditation-response.dto';
import { GetMeditationService } from './get-meditation.service';
import { toMeditationResponse } from '../mappers';
import {
  assertMeditationPeriod,
  formatDateOnly,
  parseDateAsLocal,
} from '../utils';
import { MEDITATION_ENTITY_TYPE, MEDITATION_FILE_FIELD } from '../constants';

@Injectable()
export class UpdateMeditationService {
  private readonly logger = new Logger(UpdateMeditationService.name);

  constructor(
    private readonly meditationRepo: MeditationRepository,
    private readonly getService: GetMeditationService,
    private readonly s3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async update(
    id: string,
    dto: UpdateMeditationDto,
    file?: Express.Multer.File,
  ): Promise<MeditationResponseDto> {
    const existing = await this.getService.findEntityOrFail(id);

    const startDate = formatDateOnly(
      parseDateAsLocal(dto.startDate ?? existing.startDate),
    );
    const endDate = formatDateOnly(
      parseDateAsLocal(dto.endDate ?? existing.endDate),
    );

    assertMeditationPeriod({
      startDate: parseDateAsLocal(startDate),
      endDate: parseDateAsLocal(endDate),
    });

    await this.assertNoOverlap(startDate, endDate, id);

    // O upload acontece fora da transação: o rastreador permite apagar do S3 o
    // arquivo enviado caso a atualização falhe depois dele.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.s3Service.upload(file),
    );

    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela.
      const updated = await this.meditationRepo.runInTransaction(
        async (manager: EntityManager) => {
          // Só os campos de conteúdo são copiados: um merge do DTO inteiro
          // deixaria `id` e `media` sobrescreverem a entidade.
          existing.topic = dto.topic ?? existing.topic;
          existing.startDate = startDate;
          existing.endDate = endDate;

          const saved = await this.meditationRepo.saveMeditation(
            existing,
            manager,
          );

          if (dto.days) {
            await this.meditationRepo.removeDays(existing.days ?? [], manager);
            saved.days = await this.meditationRepo.saveDays(
              saved,
              dto.days,
              manager,
            );
          }

          return saved;
        },
      );

      if (dto.media) {
        await this.syncMedia(dto.media, updated.id, uploads, file);
      }

      this.logger.log(`Meditação atualizada. ID=${updated.id}`);

      const media = await this.getService.findMediaOf(updated.id);
      return toMeditationResponse(updated, media);
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3Service.delete(url),
      );

      this.logger.error(
        `Erro ao atualizar meditação. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro inesperado ao atualizar meditação.',
        error as Error,
      );
    }
  }

  private async assertNoOverlap(
    startDate: string,
    endDate: string,
    excludeId: string,
  ): Promise<void> {
    const conflict = await this.meditationRepo.findOverlapping(
      startDate,
      endDate,
      excludeId,
    );

    if (conflict) {
      throw new AppConflictException(
        ErrorCode.RESOURCE_CONFLICT,
        'Conflito com outra meditação existente.',
      );
    }
  }

  /** Substitui a mídia da meditação, preservando o arquivo quando não muda. */
  private async syncMedia(
    media: MediaItemDto,
    meditationId: string,
    uploads: S3UploadTracker,
    file?: Express.Multer.File,
  ): Promise<MediaItemEntity | undefined> {
    const fieldKey = media.fieldKey ?? MEDITATION_FILE_FIELD;
    const filesDict = file ? { [fieldKey]: file } : {};

    const existingMedia = await this.mediaItemProcessor.findMediaItemsByTarget(
      meditationId,
      MEDITATION_ENTITY_TYPE,
    );

    const [saved] = await this.mediaItemProcessor.cleanAndReplaceMediaItems(
      [
        {
          // Sem o id no payload, a mídia atual do alvo é o item a atualizar:
          // tratá-la como desconhecida faria a substituição apagar o arquivo.
          id: media.id ?? existingMedia[0]?.id,
          title: media.title,
          description: media.description,
          mediaType: media.mediaType,
          uploadType: media.uploadType,
          platformType: media.isLocalFile ? null : media.platformType,
          url: media.url,
          originalName: media.originalName,
          size: media.size,
          isLocalFile: media.isLocalFile,
          fileField: fieldKey,
        },
      ],
      meditationId,
      MEDITATION_ENTITY_TYPE,
      filesDict,
      existingMedia,
      (url: string) => this.s3Service.delete(url),
      uploads.upload,
    );

    return saved;
  }
}
