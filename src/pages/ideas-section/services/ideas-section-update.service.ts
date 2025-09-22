import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { UploadType } from 'src/share/media/media-item/media-item.entity';
import { IdeasSectionMediaType } from '../enums/ideas-section-media-type.enum';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { IdeasSectionRepository } from '../repository/ideas-section.repository';
import { UpdateIdeasSectionDto } from '../dto/update-ideas-section.dto';
import { IdeasSectionMediaItemDto } from '../dto/ideas-section-media-item.dto';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { IdeasSectionResponseDto } from '../dto/ideas-section-response.dto';
import { IdeasSectionEntity } from 'src/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from 'src/pages/ideas-page/entities/ideas-page.entity';

@Injectable()
export class IdeasSectionUpdateService {
  private readonly logger = new Logger(IdeasSectionUpdateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly ideasSectionRepository: IdeasSectionRepository,
  ) { }

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
      const savedSection = await this.upsertSection(dto, existingSection.page, queryRunner);
      const normalized = (dto.medias || []).map((item) => ({
        ...item,
        mediaType:
          item.mediaType === IdeasSectionMediaType.VIDEO ? 'video' :
            item.mediaType === IdeasSectionMediaType.DOCUMENT ? 'document' :
              'image',
        uploadType: item.uploadType,
        fileField:
          item.uploadType === 'upload' && item.isLocalFile
            ? item.fieldKey
            : undefined,
      }));

      this.logger.debug(`🖼️ Processando ${dto.medias.length} mídias`);
      const processedMedia = await this.processSectionMedia(
        dto.medias || [],
        savedSection.id,
        existingMedia,
        filesDict,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      return IdeasSectionResponseDto.fromEntity(savedSection, processedMedia);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao atualizar seção', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Erro ao atualizar a seção de ideias');
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
    this.logger.log(`🚀 Editando e vinculando seção órfã ID=${sectionId} à página ID=${pageId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingSection = await queryRunner.manager.findOne(IdeasSectionEntity, {
        where: { id: sectionId },
      });

      if (!existingSection) {
        throw new NotFoundException(`Seção de ideias com ID=${sectionId} não encontrada`);
      }
      if (existingSection.page) {
        throw new BadRequestException(
          `Seção ID=${sectionId} já está vinculada à página ID=${existingSection.page.id}`
        );
      }

      const ideasPage = await queryRunner.manager.findOne(IdeasPageEntity, {
        where: { id: pageId },
      });

      if (!ideasPage) {
        throw new NotFoundException(`Página de ideias com ID=${pageId} não encontrada`);
      }

      const existingMedia = await queryRunner.manager.find(MediaItemEntity, {
        where: {
          targetId: sectionId,
          targetType: MediaTargetType.IdeasSection,
        },
      });

      this.validateFiles(dto, filesDict);

      const updatedSection = queryRunner.manager.merge(IdeasSectionEntity, existingSection, {
        title: dto.title,
        description: dto.description,
        public: dto.public,
        page: ideasPage,
      });

      const savedSection = await queryRunner.manager.save(updatedSection);

      const normalized = dto.medias.map((item) => ({
        ...item,
        mediaType:
          item.mediaType === IdeasSectionMediaType.VIDEO ? 'video' :
            item.mediaType === IdeasSectionMediaType.DOCUMENT ? 'document' :
              'image',
        uploadType: item.uploadType,
        fileField:
          item.uploadType === 'upload' && item.isLocalFile
            ? item.fieldKey
            : undefined,
      }));

      this.logger.debug(`📊 Dados para processamento:`);
      this.logger.debug(`   - Mídias no payload: ${dto.medias.length}`);
      this.logger.debug(`   - Mídias existentes: ${existingMedia.length}`);
      this.logger.debug(`   - Mídias normalizadas: ${normalized.length}`);
      this.logger.debug(`   - IDs no payload: ${dto.medias.map(m => m.id).join(', ')}`);
      this.logger.debug(`   - IDs existentes: ${existingMedia.map(m => m.id).join(', ')}`);

      this.logger.debug(`🗑️ Iniciando exclusão de mídias obsoletas`);
      await this.deleteMedia(existingMedia, dto.medias, queryRunner);
      this.logger.debug(`✅ Exclusão de mídias concluída com sucesso`);

      this.logger.debug(`🖼️ Processando ${dto.medias.length} mídias`);
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

      this.logger.log(`✅ Seção ID=${sectionId} editada e vinculada à página ID=${pageId} com sucesso`);
      return IdeasSectionResponseDto.fromEntity(savedSection, processedMedia);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao editar e vincular seção', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Erro ao editar e vincular a seção de ideias');
    } finally {
      await queryRunner.release();
    }
  }

  private async validateSection(id: string, queryRunner: any): Promise<IdeasSectionEntity> {
    this.logger.debug(`🔍 Buscando seção com ID: ${id} no banco de dados`);
    const section = await queryRunner.manager.findOne(IdeasSectionEntity, {
      where: { id },
      relations: ['page'],
    });
    if (!section) {
      this.logger.warn(`⚠️ Seção com ID ${id} não encontrada`);
      throw new NotFoundException('Seção de ideias não encontrada');
    }
    this.logger.debug(`✅ Seção encontrada e validada: ID=${section.id}, title="${section.title}"`);
    return section;
  }

  private async validateMedia(sectionIds: string[], queryRunner: any): Promise<MediaItemEntity[]> {
    this.logger.debug(`🔍 Buscando mídias para seções: ${sectionIds.join(', ')}`);
    const media = await queryRunner.manager.find(MediaItemEntity, {
      where: {
        targetId: sectionIds[0],
        targetType: MediaTargetType.IdeasSection,
      },
    });
    this.logger.debug(`✅ ${media.length} mídias encontradas e validadas: ${media.map(m => `ID=${m.id}`).join(', ')}`);
    return media;
  }

  private async upsertSection(
    sectionInput: UpdateIdeasSectionDto,
    page: IdeasPageEntity | null,
    queryRunner: any,
  ): Promise<IdeasSectionEntity> {
    this.logger.debug(`🔄 Preparando upsert de seção: title="${sectionInput.title}"`);
    const sectionToUpsert: Partial<IdeasSectionEntity> = {
      title: sectionInput.title,
      description: sectionInput.description,
      public: sectionInput.public ?? true,
      page: page || undefined,
    };
    this.logger.debug(`💾 Salvando seção no banco com dados: ${JSON.stringify(sectionToUpsert)}`);
    const savedSection = await queryRunner.manager.save(IdeasSectionEntity, sectionToUpsert);
    this.logger.debug(`✅ Seção upsertada com sucesso: ID=${savedSection.id}, title="${savedSection.title}"`);
    return savedSection;
  }



  private validateFiles(dto: UpdateIdeasSectionDto, filesDict: Record<string, Express.Multer.File>) {
    for (const media of dto.medias) {
      if (media.uploadType === UploadType.UPLOAD && media.isLocalFile && (!media.id || media.fieldKey)) {
        if (!media.originalName) {
          throw new BadRequestException('Campo originalName ausente');
        }
        if (media.fieldKey && !filesDict[media.fieldKey]) {
          throw new BadRequestException(`Arquivo não encontrado para fieldKey: ${media.fieldKey}`);
        }
      }
    }
  }

  private async deleteMedia(
    existingMedia: MediaItemEntity[],
    requestedMedias: IdeasSectionMediaItemDto[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    this.logger.debug(`🗑️ Identificando mídias para remoção`);
    const requestedMediaIds = requestedMedias
      .map(media => media.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    this.logger.debug(`📋 IDs de mídias recebidas: ${requestedMediaIds.join(', ') || 'nenhum'}`);

    const mediaToRemove = existingMedia.filter(
      existing => existing.id && !requestedMediaIds.includes(existing.id),
    );
    this.logger.debug(
      `🗑️ ${mediaToRemove.length} mídias marcadas para remoção: ${mediaToRemove.map(m => m.id).join(', ')}`,
    );

    for (const media of mediaToRemove) {
      if (!media.id) {
        this.logger.warn(`⚠️ Mídia sem ID detectada, pulando exclusão: URL=${media.url || 'desconhecida'}`);
        continue;
      }
      this.logger.debug(`🗑️ Iniciando remoção da mídia ID: ${media.id}, URL="${media.url || 'não fornecida'}"`);

      if (media.isLocalFile && media.url) {
        this.logger.debug(`🗑️ Removendo arquivo do S3: ${media.url}`);
        try {
          await this.awsS3Service.delete(media.url);
          this.logger.debug(`✅ Arquivo removido do S3 com sucesso: ${media.url}`);
        } catch (error) {
          this.logger.error(`❌ Falha ao remover arquivo do S3: ${media.url}`, error.stack);
          throw new BadRequestException(`Falha ao remover arquivo do S3: ${media.url}`);
        }
      }

      this.logger.debug(`🗑️ Removendo mídia do banco de dados: ID=${media.id}`);
      await queryRunner.manager.delete(MediaItemEntity, { id: media.id });
      this.logger.debug(`✅ Mídia removida do banco com sucesso: ID=${media.id}`);
    }
    this.logger.debug(`✅ Processo de remoção de mídias concluído`);
  }

  private async processSectionMedia(
    mediaItems: IdeasSectionMediaItemDto[],
    sectionId: string,
    oldMedia: MediaItemEntity[],
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity[]> {
    this.logger.debug(`📽️ Iniciando processamento de ${mediaItems.length} mídias para seção ID: ${sectionId}`);
    const processedMedia: MediaItemEntity[] = [];

    for (const mediaInput of mediaItems) {
      this.logger.debug(
        `📽️ Processando mídia: id=${mediaInput.id || 'novo'}, fieldKey="${mediaInput.fieldKey || 'não fornecido'}", mediaType=${mediaInput.mediaType}, uploadType=${mediaInput.uploadType}`,
      );

      if (mediaInput.id) {
        this.logger.debug(`🔄 Iniciando upsert de mídia existente com ID: ${mediaInput.id}`);
        const savedMedia = await this.upsertMedia(mediaInput, sectionId, filesDict, queryRunner);
        processedMedia.push(savedMedia);
        this.logger.debug(
          `✅ Mídia upsertada com sucesso: ID=${savedMedia.id}, URL=${savedMedia.url}, targetId=${savedMedia.targetId}, targetType=${savedMedia.targetType}`,
        );
      } else {
        this.logger.debug(
          `🆕 Iniciando adição de nova mídia: fieldKey="${mediaInput.fieldKey || 'não fornecido'}"`,
        );
        const savedMedia = await this.addMedia(mediaInput, sectionId, filesDict, queryRunner);
        processedMedia.push(savedMedia);
        this.logger.debug(
          `✅ Nova mídia adicionada com sucesso: ID=${savedMedia.id}, URL=${savedMedia.url}, targetId=${savedMedia.targetId}, targetType=${savedMedia.targetType}`,
        );
      }
    }

    this.logger.debug(
      `✅ Processamento de mídias concluído: ${processedMedia.length} mídias processadas para seção ID: ${sectionId}`,
    );
    return processedMedia;
  }

  private async addMedia(
    mediaInput: IdeasSectionMediaItemDto,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    this.logger.debug(`🆕 Construindo nova mídia: "${mediaInput.title || 'não fornecido'}"`);

    const media = this.mediaItemProcessor.buildBaseMediaItem(
      { ...mediaInput, mediaType: mediaInput.mediaType as any || IdeasSectionMediaType.IMAGE },
      targetId,
      MediaTargetType.IdeasSection,
    );

    if (mediaInput.uploadType === UploadType.UPLOAD || mediaInput.isLocalFile === true) {
      media.platformType = undefined;
      if (!mediaInput.fieldKey) {
        this.logger.error(`❌ FieldKey ausente para mídia "${mediaInput.title}"`);
        throw new BadRequestException(`FieldKey ausente para mídia "${mediaInput.title}"`);
      }
      const file = filesDict[mediaInput.fieldKey];
      if (!file) {
        this.logger.error(`❌ Arquivo ausente para mídia "${mediaInput.title}" (fieldKey: ${mediaInput.fieldKey})`);
        throw new BadRequestException(`Arquivo ausente para mídia "${mediaInput.title}"`);
      }
      this.logger.debug(`⬆️ Fazendo upload da mídia "${file.originalname}" para S3`);
      media.url = await this.awsS3Service.upload(file);
      media.isLocalFile = mediaInput.isLocalFile;
      media.originalName = file.originalname;
      media.size = file.size;
      this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
    } else {
      media.title = mediaInput.title || media.title;
      media.description = mediaInput.description || media.description;
      media.uploadType = mediaInput.uploadType || media.uploadType;
      media.platformType = mediaInput.platformType || media.platformType;
      media.mediaType = (mediaInput.mediaType as any) || media.mediaType;
      media.url = mediaInput.url?.trim() || media.url;
      media.originalName = mediaInput.originalName || media.originalName;
      media.isLocalFile = mediaInput.isLocalFile || media.isLocalFile;
      media.size = mediaInput.size || media.size;
      this.logger.debug(`🔗 Usando URL externa para mídia: "${media.url}"`);
    }

    this.logger.debug(`💾 Salvando mídia no banco`);
    const savedMedia = await this.mediaItemProcessor.saveMediaItem(media);
    this.logger.debug(`✅ Mídia salva com ID=${savedMedia.id}`);
    return savedMedia;
  }

  private async upsertMedia(
    mediaInput: IdeasSectionMediaItemDto,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    this.logger.debug(
      `🔄 Iniciando upsert de mídia: ID=${mediaInput.id || 'novo'}, fieldKey="${mediaInput.fieldKey || 'não fornecido'}"`,
    );
    this.logger.debug(`📋 Construindo base da mídia para targetId: ${targetId}`);

    const media = this.mediaItemProcessor.buildBaseMediaItem(
      { ...mediaInput, mediaType: mediaInput.mediaType as any },
      targetId,
      MediaTargetType.IdeasSection,
    );

    if (mediaInput.isLocalFile && !mediaInput.id && mediaInput.uploadType === UploadType.UPLOAD) {
      this.logger.debug(`🔍 Verificando arquivo para upload: fieldKey=${mediaInput.fieldKey || mediaInput.url}`);
      const key = mediaInput.fieldKey ?? mediaInput.url;
      if (!key) {
        this.logger.error(`❌ Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
        throw new BadRequestException(`Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
      }
      const file = filesDict[key];
      if (!file) {
        this.logger.error(`❌ Arquivo não encontrado para chave: ${key}`);
        throw new BadRequestException(`Arquivo não encontrado para upload: ${key}`);
      }
      this.logger.debug(`📤 Iniciando upload do arquivo para S3: ${file.originalname}`);
      media.url = await this.awsS3Service.upload(file);
      media.originalName = file.originalname;
      media.isLocalFile = mediaInput.isLocalFile;
      media.size = file.size;
      this.logger.debug(`✅ Upload concluído com sucesso, URL: ${media.url}`);
    } else {
      media.title = mediaInput.title || media.title;
      media.description = mediaInput.description || media.description;
      media.uploadType = mediaInput.uploadType || media.uploadType;
      media.platformType = mediaInput.platformType || media.platformType;
      media.mediaType = (mediaInput.mediaType as any) || media.mediaType;
      media.url = mediaInput.url?.trim() || media.url;
      media.originalName = mediaInput.originalName || media.originalName;
      media.isLocalFile = mediaInput.isLocalFile || media.isLocalFile;
      media.size = mediaInput.size || media.size;
      this.logger.debug(`🔗 Usando URL externa para mídia: "${media.url}"`);
    }

    this.logger.debug(`💾 Salvando mídia no banco com dados: ${JSON.stringify(media)}`);
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, {
      ...media,
      id: mediaInput.id,
    });
    this.logger.debug(
      `✅ Mídia upsertada com sucesso: ID=${savedMedia.id}, URL=${savedMedia.url}, targetId=${savedMedia.targetId}, targetType=${savedMedia.targetType}`,
    );
    return savedMedia;
  }
}