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
      );

      await queryRunner.commitTransaction();

      return IdeasSectionResponseDto.fromEntity(savedSection, processedMedia);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
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
      );

      ideasPage.sections = [...(ideasPage.sections || []), savedSection];
      await queryRunner.manager.save(IdeasPageEntity, ideasPage);

      await queryRunner.commitTransaction();

      return IdeasSectionResponseDto.fromEntity(savedSection, processedMedia);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
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
        try {
          await this.awsS3Service.delete(media.url);
        } catch (error: unknown) {
          const errStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Falha ao remover arquivo do S3: ${media.url}`,
            errStack,
          );
          throw new AppInternalException(
            ErrorCode.S3_DELETE_ERROR,
            `Falha ao remover arquivo do S3: ${media.url}`,
            error as Error,
          );
        }
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
  ): Promise<MediaItemEntity[]> {
    const processedMedia: MediaItemEntity[] = [];

    for (const mediaInput of mediaItems) {
      if (mediaInput.id) {
        const savedMedia = await this.upsertMedia(
          mediaInput,
          sectionId,
          filesDict,
          queryRunner,
        );
        processedMedia.push(savedMedia);
      } else {
        const savedMedia = await this.addMedia(
          mediaInput,
          sectionId,
          filesDict,
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
    // _queryRunner: QueryRunner,
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
      media.url = await this.awsS3Service.upload(file);
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
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType: mediaInput.mediaType as unknown as MediaType,
      },
      targetId,
      MediaTargetType.IdeasSection,
    );

    // Busca mídia existente para verificar se precisa deletar arquivo antigo do S3
    let existingMedia: MediaItemEntity | null = null;
    if (mediaInput.id) {
      existingMedia = await queryRunner.manager.findOne(MediaItemEntity, {
        where: { id: mediaInput.id },
      });
    }

    if (
      mediaInput.isLocalFile &&
      !mediaInput.id &&
      mediaInput.uploadType === UploadType.UPLOAD
    ) {
      const key = mediaInput.fieldKey ?? mediaInput.url;
      if (!key) {
        this.logger.error(
          `Arquivo ausente para upload: nenhum fieldKey ou url fornecido`,
        );
        throw new AppValidationException(
          ErrorCode.MEDIA_FIELD_MISSING,
          `Arquivo ausente para upload: nenhum fieldKey ou url fornecido`,
        );
      }
      const file = filesDict[key];
      if (!file) {
        this.logger.error(`Arquivo não encontrado para chave: ${key}`);
        throw new AppValidationException(
          ErrorCode.MEDIA_FILE_NOT_FOUND,
          `Arquivo não encontrado para upload: ${key}`,
        );
      }
      media.url = await this.awsS3Service.upload(file);
      media.originalName = file.originalname;
      media.isLocalFile = mediaInput.isLocalFile;
      media.size = file.size;
    } else {
      // Verifica se está mudando de UPLOAD para LINK e deleta arquivo antigo do S3
      const isNowLink =
        mediaInput.uploadType === UploadType.LINK ||
        mediaInput.isLocalFile === false;

      if (
        existingMedia &&
        existingMedia.isLocalFile &&
        existingMedia.url &&
        isNowLink
      ) {
        const oldUrl = existingMedia.url;
        this.logger.log(
          `🗑️ Deletando arquivo antigo do S3 (mudança UPLOAD→LINK): ${oldUrl}`,
        );
        try {
          await this.awsS3Service.delete(oldUrl);
          this.logger.debug(`✅ Arquivo antigo removido do S3: ${oldUrl}`);
        } catch (error: unknown) {
          const errStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Falha ao remover arquivo antigo do S3: ${oldUrl}`,
            errStack,
          );
          throw new AppInternalException(
            ErrorCode.S3_DELETE_ERROR,
            `Falha ao remover arquivo antigo do S3: ${oldUrl}`,
            error as Error,
          );
        }
      }

      media.title = mediaInput.title || media.title;
      media.description = mediaInput.description || media.description;
      media.uploadType = mediaInput.uploadType || media.uploadType;
      media.platformType = mediaInput.platformType || media.platformType;
      media.mediaType =
        (mediaInput.mediaType as unknown as MediaType) || media.mediaType;
      media.url = mediaInput.url?.trim() || media.url;
      media.originalName = mediaInput.originalName || media.originalName;
      media.isLocalFile = mediaInput.isLocalFile ?? media.isLocalFile;
      media.size = mediaInput.size || media.size;
    }

    const savedMedia = await queryRunner.manager.save(MediaItemEntity, {
      ...media,
      id: mediaInput.id,
    });
    return savedMedia;
  }
}
