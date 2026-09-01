import { Injectable, Logger } from '@nestjs/common';
import {
  AppNotFoundException,
  AppBusinessException,
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionMediaType } from '../enums/ideas-section-media-type.enum';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { IdeasSectionRepository } from '../repository/ideas-section.repository';
import { UpdateIdeasSectionDto } from '../dto/update-ideas-section.dto';
import { IdeasSectionMediaItemDto } from '../dto/ideas-section-media-item.dto';
import {
  MediaItemEntity,
  MediaType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionResponseDto } from '../dto/ideas-section-response.dto';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from 'src/modules/pages/ideas-page/entities/ideas-page.entity';

@Injectable()
export class IdeasSectionUpdateService {
  private readonly logger = new Logger(IdeasSectionUpdateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly ideasSectionRepository: IdeasSectionRepository,
  ) {}

  async updateSection(
    id: string,
    dto: UpdateIdeasSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<IdeasSectionResponseDto> {
    this.logger.log(`🚀 Iniciando atualização de seção de ideias ID=${id}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Os arquivos sobem fora da transação: o rastreador permite apagá-los do
    // bucket quando a atualização falha depois do upload.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      const existingSection = await this.validateSection(id, queryRunner);

      const existingMedia = await this.validateMedia([id], queryRunner);
      const savedSection = await this.upsertSection(
        dto,
        existingSection.page,
        queryRunner,
      );
      (dto.medias || []).map((item) => ({
        ...item,
        mediaType:
          item.mediaType === IdeasSectionMediaType.VIDEO
            ? 'video'
            : item.mediaType === IdeasSectionMediaType.DOCUMENT
              ? 'document'
              : 'image',
        uploadType: item.uploadType,
        fileField:
          item.uploadType === UploadType.UPLOAD && item.isLocalFile
            ? item.fieldKey
            : undefined,
      }));

      this.logger.debug(`🖼️ Processando ${dto.medias?.length ?? 0} mídias`);
      const processedMedia = await this.processSectionMedia(
        dto.medias || [],
        savedSection.id,
        existingMedia,
        filesDict,
        queryRunner,
        uploads,
      );

      await queryRunner.commitTransaction();

      return IdeasSectionResponseDto.fromEntity(savedSection, processedMedia);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro ao atualizar seção', errStack);
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_UPDATE_ERROR,
        'Erro ao atualizar a seção de ideias',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async editAndAttachSectionToPage(
    sectionId: string,
    pageId: string,
    dto: UpdateIdeasSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<IdeasSectionResponseDto> {
    this.logger.log(
      `🚀 Editando e vinculando seção órfã ID=${sectionId} à página ID=${pageId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Os arquivos sobem fora da transação: o rastreador permite apagá-los do
    // bucket quando a operação falha depois do upload.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      const existingSection = await queryRunner.manager.findOne(
        IdeasSectionEntity,
        {
          where: { id: sectionId },
        },
      );

      if (!existingSection) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Seção de ideias com ID=${sectionId} não encontrada`,
        );
      }
      if (existingSection.page) {
        throw new AppBusinessException(
          ErrorCode.SECTION_UPDATE_ERROR,
          `Seção ID=${sectionId} já está vinculada à página ID=${existingSection.page.id}`,
        );
      }

      const ideasPage = await queryRunner.manager.findOne(IdeasPageEntity, {
        where: { id: pageId },
      });

      if (!ideasPage) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Página de ideias com ID=${pageId} não encontrada`,
        );
      }

      const existingMedia = await queryRunner.manager.find(MediaItemEntity, {
        where: {
          targetId: sectionId,
          targetType: MediaTargetType.IdeasSection,
        },
      });

      this.validateFiles(dto, filesDict);

      const updatedSection = queryRunner.manager.merge(
        IdeasSectionEntity,
        existingSection,
        {
          title: dto.title,
          description: dto.description,
          public: dto.public,
          page: ideasPage,
        },
      );

      const savedSection = await queryRunner.manager.save(updatedSection);

      await this.deleteMedia(existingMedia, dto.medias, queryRunner);

      const processedMedia = await this.processSectionMedia(
        dto.medias || [],
        savedSection.id,
        existingMedia,
        filesDict,
        queryRunner,
        uploads,
      );

      ideasPage.sections = [...(ideasPage.sections || []), savedSection];
      await queryRunner.manager.save(IdeasPageEntity, ideasPage);

      await queryRunner.commitTransaction();

      return IdeasSectionResponseDto.fromEntity(savedSection, processedMedia);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro ao editar e vincular seção', errStack);
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_UPDATE_ERROR,
        'Erro ao editar e vincular a seção de ideias',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async validateSection(
    id: string,
    queryRunner: QueryRunner,
  ): Promise<IdeasSectionEntity> {
    const section = await queryRunner.manager.findOne(IdeasSectionEntity, {
      where: { id },
      relations: ['page'],
    });
    if (!section) {
      this.logger.warn(`⚠️ Seção com ID ${id} não encontrada`);
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Seção de ideias não encontrada',
      );
    }
    return section;
  }

  private async validateMedia(
    sectionIds: string[],
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity[]> {
    const media = await queryRunner.manager.find(MediaItemEntity, {
      where: {
        targetId: sectionIds[0],
        targetType: MediaTargetType.IdeasSection,
      },
    });
    return media;
  }

  private async upsertSection(
    sectionInput: UpdateIdeasSectionDto,
    page: IdeasPageEntity | null,
    queryRunner: QueryRunner,
  ): Promise<IdeasSectionEntity> {
    const sectionToUpsert: Partial<IdeasSectionEntity> = {
      title: sectionInput.title,
      description: sectionInput.description,
      public: sectionInput.public ?? true,
      page: page || undefined,
    };
    const savedSection = await queryRunner.manager.save(
      IdeasSectionEntity,
      sectionToUpsert,
    );
    return savedSection;
  }

  private validateFiles(
    dto: UpdateIdeasSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ) {
    for (const media of dto.medias) {
      if (
        media.uploadType === UploadType.UPLOAD &&
        media.isLocalFile &&
        (!media.id || media.fieldKey)
      ) {
        if (!media.originalName) {
          throw new AppValidationException(
            ErrorCode.MEDIA_FIELD_MISSING,
            'Campo originalName ausente',
          );
        }
        if (media.fieldKey && !filesDict[media.fieldKey]) {
          throw new AppValidationException(
            ErrorCode.MEDIA_FILE_NOT_FOUND,
            `Arquivo não encontrado para fieldKey: ${media.fieldKey}`,
          );
        }
      }
    }
  }

  private async deleteMedia(
    existingMedia: MediaItemEntity[],
    requestedMedias: IdeasSectionMediaItemDto[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    const requestedMediaIds = requestedMedias
      .map((media) => media.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const mediaToRemove = existingMedia.filter(
      (existing) => existing.id && !requestedMediaIds.includes(existing.id),
    );

    for (const media of mediaToRemove) {
      if (!media.id) {
        continue;
      }

      if (media.isLocalFile && media.url) {
        // A falha na remoção é registrada, não interrompe: abortar a edição
        // por causa do S3 deixaria a seção pela metade.
        await this.awsS3Service.delete(media.url);
      }

      await queryRunner.manager.delete(MediaItemEntity, { id: media.id });
    }
  }

  private async processSectionMedia(
    mediaItems: IdeasSectionMediaItemDto[],
    sectionId: string,
    oldMedia: MediaItemEntity[],
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
    uploads: S3UploadTracker,
  ): Promise<MediaItemEntity[]> {
    const oldById = new Map(oldMedia.map((item) => [item.id, item]));

    const processedMedia: MediaItemEntity[] = [];

    for (const mediaInput of mediaItems) {
      if (mediaInput.id) {
        const savedMedia = await this.upsertMedia(
          mediaInput,
          sectionId,
          filesDict,
          queryRunner,
          uploads,
          oldById.get(mediaInput.id),
        );
        processedMedia.push(savedMedia);
      } else {
        const savedMedia = await this.addMedia(
          mediaInput,
          sectionId,
          filesDict,
          uploads,
        );
        processedMedia.push(savedMedia);
      }
    }
    return processedMedia;
  }

  private async addMedia(
    mediaInput: IdeasSectionMediaItemDto,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    uploads: S3UploadTracker,
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType:
          (mediaInput.mediaType as unknown as MediaType) ||
          IdeasSectionMediaType.IMAGE,
      },
      targetId,
      MediaTargetType.IdeasSection,
    );

    if (
      mediaInput.uploadType === UploadType.UPLOAD ||
      mediaInput.isLocalFile === true
    ) {
      media.platformType = undefined;
      if (!mediaInput.fieldKey) {
        this.logger.error(`FieldKey ausente para mídia "${mediaInput.title}"`);
        throw new AppValidationException(
          ErrorCode.MEDIA_FIELD_MISSING,
          `FieldKey ausente para mídia "${mediaInput.title}"`,
        );
      }
      const file = filesDict[mediaInput.fieldKey];
      if (!file) {
        this.logger.error(
          `Arquivo ausente para mídia "${mediaInput.title}" (fieldKey: ${mediaInput.fieldKey})`,
        );
        throw new AppValidationException(
          ErrorCode.MEDIA_FILE_NOT_FOUND,
          `Arquivo ausente para mídia "${mediaInput.title}"`,
        );
      }
      media.url = await uploads.upload(file);
      media.isLocalFile = mediaInput.isLocalFile;
      media.originalName = file.originalname;
      media.size = file.size;
    } else {
      media.title = mediaInput.title || media.title;
      media.description = mediaInput.description || media.description;
      media.uploadType = mediaInput.uploadType || media.uploadType;
      media.platformType = mediaInput.platformType || media.platformType;
      media.mediaType =
        (mediaInput.mediaType as unknown as MediaType) || media.mediaType;
      media.url = mediaInput.url?.trim() || media.url;
      media.originalName = mediaInput.originalName || media.originalName;
      media.isLocalFile = mediaInput.isLocalFile || media.isLocalFile;
      media.size = mediaInput.size || media.size;
    }

    const savedMedia = await this.mediaItemProcessor.saveMediaItem(media);
    return savedMedia;
  }

  private async upsertMedia(
    mediaInput: IdeasSectionMediaItemDto,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
    uploads: S3UploadTracker,
    previous?: MediaItemEntity,
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType: mediaInput.mediaType as unknown as MediaType,
      },
      targetId,
      MediaTargetType.IdeasSection,
    );

    const isUpload =
      mediaInput.uploadType === UploadType.UPLOAD ||
      mediaInput.isLocalFile === true;
    const fileKey = mediaInput.fieldKey ?? mediaInput.url;
    const file = fileKey ? filesDict[fileKey] : undefined;

    if (isUpload && file) {
      // Troca de arquivo em uma mídia já gravada: o novo sobe primeiro e o
      // antigo só sai depois que o registro passa a apontar para ele.
      media.url = await uploads.upload(file);
      media.originalName = file.originalname;
      media.isLocalFile = true;
      media.size = file.size;
      media.platformType = undefined;
    } else if (isUpload && !previous?.url) {
      // Upload sem arquivo e sem nada guardado para reaproveitar.
      this.logger.error(
        `Arquivo ausente para a mídia "${mediaInput.title ?? ''}"`,
      );
      throw new AppValidationException(
        ErrorCode.MEDIA_FILE_NOT_FOUND,
        `Arquivo ausente para a mídia "${mediaInput.title ?? ''}"`,
      );
    } else {
      // Sem arquivo novo, o objeto que já está no S3 é preservado.
      media.title = mediaInput.title || media.title;
      media.description = mediaInput.description || media.description;
      media.uploadType = mediaInput.uploadType || media.uploadType;
      media.platformType = mediaInput.platformType || media.platformType;
      media.mediaType =
        (mediaInput.mediaType as unknown as MediaType) || media.mediaType;
      media.url = mediaInput.url?.trim() || previous?.url || media.url;
      media.originalName =
        mediaInput.originalName || previous?.originalName || media.originalName;
      media.isLocalFile =
        mediaInput.isLocalFile ?? previous?.isLocalFile ?? media.isLocalFile;
      media.size = mediaInput.size || previous?.size || media.size;
    }

    const savedMedia = await queryRunner.manager.save(MediaItemEntity, {
      ...media,
      id: mediaInput.id,
    });

    if (
      previous?.isLocalFile &&
      previous.url &&
      previous.url !== savedMedia.url
    ) {
      await this.awsS3Service.delete(previous.url);
    }

    return savedMedia;
  }
}
