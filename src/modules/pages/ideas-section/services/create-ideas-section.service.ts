import { CreateIdeaSnapshotService } from '../../ideas-section-ai/services/create-idea-snapshot.service';
import { CreateIdeaAiEnhancementService } from '../../ideas-section-ai/services/create-idea-ai-enhancement.service';
import { IdeaSubmissionSnapshotSource } from '../../ideas-section-ai/enums/ideas-section-ai.enums';
import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AppInternalException, ErrorCode } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionMediaType } from '../entities/ideas-section-media-type.enum';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { NotificationService } from 'src/shared/providers/notification/notification.service';
import { CreateIdeasSectionDto } from '../dto/create-ideas-section.dto';
import { IdeasSectionResponseDto } from '../dto/ideas-section-response.dto';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';
import { toIdeasSectionResponse } from '../mappers';
import { applyGeneratedMediaMetadata } from '../utils';
import { validateIdeasShareMedia } from '../media-validation';
import { UploadedFilesDict } from '../types';

@Injectable()
export class CreateIdeasSectionService {
  private readonly logger = new Logger(CreateIdeasSectionService.name);

  constructor(
    private readonly snapshots: CreateIdeaSnapshotService,
    private readonly enhancements: CreateIdeaAiEnhancementService,
    private readonly sectionRepo: IdeasSectionsRepository,
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
    validateIdeasShareMedia(dto.medias, filesDict);
    const normalizedDto: CreateIdeasSectionDto = {
      ...dto,
      medias: applyGeneratedMediaMetadata(dto.medias, dto.title),
    };

    // Os arquivos sobem antes do commit e sobrevivem ao rollback: o rastreador
    // permite apagá-los do bucket quando a criação falha.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      const { section, mediaItems } = await this.sectionRepo.runInTransaction(
        async (manager) => {
          const created = await this.persistOrphanSection(manager, dto);
          const createdMedia = await this.processOrphanSectionMedia(
            created,
            normalizedDto,
            filesDict,
            uploads,
            manager,
          );
          await this.snapshots.capture(
            created,
            createdMedia,
            manager,
            IdeaSubmissionSnapshotSource.SUBMISSION,
          );
          return { section: created, mediaItems: createdMedia };
        },
      );

      this.logger.log(`Ideia compartilhada criada. ID=${section.id}`);

      // O aviso nunca derruba o envio: a ideia já está na fila.
      void Promise.resolve()
        .then(() =>
          this.notificationService.notifyNewIdeaShared(
            {
              title: section.title,
              description: section.description,
              createdAt: section.createdAt,
            },
            author,
          ),
        )
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'unknown error';
          this.logger.warn(
            `Falha ao notificar sobre ideia ${section.id}: ${message}`,
          );
        });

      void Promise.resolve()
        .then(() => this.enhancements.enqueueAutomatic(section.id))
        .catch((error: unknown) =>
          this.logger.warn(
            `Falha ao enfileirar melhoria da ideia ${section.id} (${
              error instanceof Error ? error.message : 'erro desconhecido'
            }). Reprocessamento manual disponível.`,
          ),
        );
      return toIdeasSectionResponse(section, mediaItems);
    } catch (error: unknown) {
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
    }
  }

  private async persistOrphanSection(
    manager: EntityManager,
    dto: CreateIdeasSectionDto,
  ): Promise<IdeasSectionEntity> {
    return this.sectionRepo.createInTransaction(manager, {
      title: dto.title,
      description: dto.description,
      // Nasce fora do ar; publicar é decisão da administração.
      public: false,
    });
  }

  private async processOrphanSectionMedia(
    section: IdeasSectionEntity,
    dto: CreateIdeasSectionDto,
    filesDict: UploadedFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
  ): Promise<MediaItemEntity[]> {
    if (!dto.medias?.length) return [];

    const normalized = dto.medias.map((item) => ({
      ...item,
      url: item.url?.trim(),
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

    return this.mediaItemProcessor.processMediaItemsPolymorphic(
      normalized,
      section.id,
      MediaTargetType.IdeasSection,
      filesDict,
      uploads.upload,
      manager,
    );
  }
}
