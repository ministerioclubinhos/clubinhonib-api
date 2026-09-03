import { Injectable, Logger } from '@nestjs/common';
import { AppInternalException, ErrorCode } from 'src/shared/exceptions';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionMediaType } from '../entities/ideas-section-media-type.enum';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { NotificationService } from 'src/shared/providers/notification/notification.service';
import { CreateIdeasSectionDto } from '../dto/create-ideas-section.dto';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionResponseDto } from '../dto/ideas-section-response.dto';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { toIdeasSectionResponse } from '../mappers';
import { assertUploadsHaveFiles } from '../utils';
import { UploadedFilesDict } from '../types';

@Injectable()
export class CreateIdeasSectionService {
  private readonly logger = new Logger(CreateIdeasSectionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Registra uma ideia compartilhada pela base.
   *
   * Ela nasce sem página: entra na fila da administração, que decide se e onde
   * publicar. Os administradores são avisados assim que ela é gravada.
   */
  async createSection(
    dto: CreateIdeasSectionDto,
    filesDict: UploadedFilesDict,
    author?: { email?: string },
  ): Promise<IdeasSectionResponseDto> {
    // Upload declarado sem arquivo vira mídia apontando para lugar nenhum; a
    // checagem existia e nunca era chamada.
    assertUploadsHaveFiles(dto.medias, filesDict);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Os arquivos sobem antes do commit e sobrevivem ao rollback: o rastreador
    // permite apagá-los do bucket quando a criação falha.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      const section = await this.persistOrphanSection(queryRunner, dto);
      await this.processOrphanSectionMedia(section, dto, filesDict, uploads);

      await queryRunner.commitTransaction();

      const mediaItems = await queryRunner.manager.find(MediaItemEntity, {
        where: {
          targetId: section.id,
          targetType: MediaTargetType.IdeasSection,
        },
      });

      this.logger.log(`Ideia compartilhada criada. ID=${section.id}`);

      // O aviso nunca derruba o envio: a ideia já está na fila.
      await this.notificationService.notifyNewIdeaShared(
        {
          title: section.title,
          description: section.description,
          createdAt: section.createdAt,
        },
        author,
      );

      return toIdeasSectionResponse(section, mediaItems);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      const errStack = error instanceof Error ? error.stack : undefined;
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Transaction rolled-back', errStack);
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_CREATE_ERROR,
        `Erro ao criar a seção de ideias: ${errMsg}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async persistOrphanSection(
    queryRunner: QueryRunner,
    dto: CreateIdeasSectionDto,
  ): Promise<IdeasSectionEntity> {
    const sectionRepo = queryRunner.manager.getRepository(IdeasSectionEntity);

    const section = sectionRepo.create({
      title: dto.title,
      description: dto.description,
      // Nasce fora do ar; publicar é decisão da administração.
      public: false,
      page: undefined,
    });

    return sectionRepo.save(section);
  }

  private async processOrphanSectionMedia(
    section: IdeasSectionEntity,
    dto: CreateIdeasSectionDto,
    filesDict: UploadedFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    if (!dto.medias?.length) return;

    const normalized = dto.medias.map((item) => ({
      ...item,
      mediaType:
        item.mediaType === IdeasSectionMediaType.VIDEO
          ? 'video'
          : item.mediaType === IdeasSectionMediaType.DOCUMENT
            ? 'document'
            : 'image',
      type: item.uploadType,
      fileField:
        item.uploadType === UploadType.UPLOAD && item.isLocalFile
          ? item.fieldKey
          : undefined,
    }));

    await this.mediaItemProcessor.processMediaItemsPolymorphic(
      normalized,
      section.id,
      MediaTargetType.IdeasSection,
      filesDict,
      uploads.upload,
    );
  }
}
