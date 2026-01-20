import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import {
    AppNotFoundException,
    AppBusinessException,
    AppInternalException,
    ErrorCode,
} from 'src/shared/exceptions';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteEntity, RouteType } from 'src/modules/routes/route-page.entity';
import { ImagePageRepository } from '../repository/image-page.repository';
import { ImageSectionRepository } from '../../image-section/repository/image-section.repository';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { UpdateImagePageDto, UpdateSectionDto } from '../dto/update-image.dto';
import { ImagePageResponseDto } from '../dto/image-page-response.dto';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { MediaItemEntity, UploadType } from 'src/shared/media/media-item/media-item.entity';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

@Injectable()
export class ImagePageUpdateService {
    private readonly logger = new Logger(ImagePageUpdateService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly imagePageRepository: ImagePageRepository,
        private readonly imageSectionRepository: ImageSectionRepository,
        private readonly routeService: RouteService,
        private readonly awsS3Service: AwsS3Service,
        private readonly mediaItemProcessor: MediaItemProcessor,
    ) {
    }

    async updateImagePage(
        id: string,
        pageData: UpdateImagePageDto,
        filesDict: Record<string, Express.Multer.File>,
    ): Promise<ImagePageResponseDto> {
        this.logger.log(`🚀 Iniciando atualização da página de imagens com ID: ${id}`);
        const queryRunner = this.dataSource.createQueryRunner();
        this.logger.debug('🔗 Conectando ao QueryRunner');
        await queryRunner.connect();
        this.logger.debug('✅ QueryRunner conectado');
        this.logger.debug('🔄 Iniciando transação');
        await queryRunner.startTransaction();
        this.logger.debug('✅ Transação iniciada');

        try {
            this.logger.debug(`🔍 Validando página existente com ID: ${id}`);
            const imagePageExisting = await this.validateImagePage(id);
            this.logger.debug(`🔍 Validando seções da página ID: ${imagePageExisting.id}`);
            const imageSectionExisting = await this.validateSections(imagePageExisting.id);
            this.logger.debug(`🔍 Validando rota da página ID: ${imagePageExisting.id}`);
            const imagePageRouteExisting = await this.validateRoute(imagePageExisting.id);
            this.logger.debug(`🔍 Validando mídias das seções`);
            const oldMedia = await this.validateMedia(imageSectionExisting.map(section => section.id));

            this.logger.debug(`🗑️ Iniciando exclusão de seções obsoletas`);
            await this.deleteSections(imageSectionExisting, pageData.sections, queryRunner);
            this.logger.debug(`✅ Exclusão de seções concluída`);
            this.logger.debug(`🗑️ Iniciando exclusão de mídias obsoletas`);
            await this.deleteMedia(oldMedia, pageData.sections, queryRunner);
            this.logger.debug(`✅ Exclusão de mídias concluída`);

            this.logger.debug(`📝 Iniciando upsert da página`);
            const savedImagePage = await this.upsertImagePage(imagePageExisting.id, pageData, queryRunner);
            this.logger.debug(`✅ Página upsertada com ID: ${savedImagePage.id}`);
            this.logger.debug(`🛤️ Iniciando upsert da rota`);
            const savedRoute = await this.upsertRoute(imagePageRouteExisting.id, pageData, savedImagePage.id);
            this.logger.debug(`✅ Rota upsertada com ID: ${savedRoute.id}`);

            const updatedSections: ImageSectionEntity[] = [];
            const mediaMap = new Map<string, MediaItemEntity[]>();

            this.logger.debug(`📂 Processando ${pageData.sections.length} seções`);
            for (const sectionInput of pageData.sections) {
                this.logger.debug(`📝 Processando seção: caption="${sectionInput.caption}", id=${sectionInput.id || 'novo'}`);
                let savedSection: ImageSectionEntity;

                if (sectionInput.id) {
                    this.logger.debug(`🔄 Upsertando seção existente`);
                    savedSection = await this.upsertSection(sectionInput, savedImagePage, queryRunner);
                } else {
                    this.logger.debug(`🆕 Adicionando nova seção`);
                    savedSection = await this.addSection(sectionInput, savedImagePage, queryRunner);
                }
                updatedSections.push(savedSection);
                this.logger.debug(`✅ Seção processada com ID: ${savedSection.id}`);

                this.logger.debug(`🖼️ Processando mídias da seção ID: ${savedSection.id}`);
                const oldSectionMedia = oldMedia.filter(m => m.targetId === savedSection.id);
                const processedMedia = await this.processSectionMedia(
                    sectionInput.mediaItems,
                    savedSection.id,
                    oldSectionMedia,
                    filesDict,
                    queryRunner
                );
                mediaMap.set(savedSection.id, processedMedia);
                this.logger.debug(`✅ ${processedMedia.length} mídias processadas para seção ID: ${savedSection.id}`);
            }

            this.logger.debug('🔗 Associando seções e rota à página');
            savedImagePage.sections = updatedSections;
            savedImagePage.route = savedRoute;
            this.logger.debug('💾 Salvando página com associações');
            const finalImagePage = await queryRunner.manager.save(ImagePageEntity, savedImagePage);
            this.logger.debug(`✅ Página final salva com ID: ${finalImagePage.id}`);

            this.logger.debug('✅ Iniciando commit da transação');
            await queryRunner.commitTransaction();
            this.logger.log(`✅ Página de imagens atualizada com sucesso: ID=${finalImagePage.id}`);
            this.logger.debug('📤 Preparando resposta DTO');
            return ImagePageResponseDto.fromEntity(finalImagePage, mediaMap);
        } catch (error) {
            this.logger.error('❌ Erro ao atualizar galeria. Iniciando rollback.', error);
            this.logger.debug('🔙 Executando rollback da transação');
            await queryRunner.rollbackTransaction();
            this.logger.debug('✅ Rollback concluído');
            throw new BadRequestException('Erro ao atualizar a galeria. Nenhum dado foi salvo.');
        } finally {
            this.logger.debug('🔚 Liberando QueryRunner');
            await queryRunner.release();
            this.logger.debug('✅ QueryRunner liberado');
        }
    }

    async validateImagePage(id: string): Promise<ImagePageEntity> {
        this.logger.debug(`🔍 Buscando página com ID: ${id}`);
        const imagePage = await this.imagePageRepository.findByIdWithSections(id);
        if (!imagePage) {
            this.logger.warn(`⚠️ Página com ID ${id} não encontrada`);
            throw new AppNotFoundException(ErrorCode.RESOURCE_NOT_FOUND, 'Página não encontrada');
        }
        this.logger.debug(`✅ Galeria validada: ID=${imagePage.id}, name="${imagePage.name}"`);
        return imagePage;
    }

    async validateSections(pageId: string): Promise<ImageSectionEntity[]> {
        this.logger.debug(`🔍 Buscando seções para página ID: ${pageId}`);
        const sections = await this.imageSectionRepository.findByPageId(pageId);
        if (!sections || sections.length === 0) {
            this.logger.warn(`⚠️ Nenhuma seção encontrada para página ID: ${pageId}`);
            throw new AppNotFoundException(ErrorCode.RESOURCE_NOT_FOUND, 'Seções da galeria não encontradas');
        }
        this.logger.debug(`✅ Seções validadas: ${sections.length} seções encontradas`);
        return sections;
    }

    async validateRoute(entityId: string): Promise<RouteEntity> {
        this.logger.debug(`🔍 Buscando rota para entityId: ${entityId}`);
        const route = await this.routeService.findRouteByEntityId(entityId);
        if (!route) {
            this.logger.warn(`⚠️ Rota para entityId ${entityId} não encontrada`);
            throw new AppNotFoundException(ErrorCode.RESOURCE_NOT_FOUND, 'Rota da galeria não encontrada');
        }
        this.logger.debug(`✅ Rota validada: ID=${route.id}, path="${route.path}"`);
        return route;
    }

    async validateMedia(sectionIds: string[]): Promise<MediaItemEntity[]> {
        this.logger.debug(`🔍 Buscando mídias para ${sectionIds.length} seções`);
        const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(sectionIds, 'ImagesPage');
        if (!media || media.length === 0) {
            this.logger.warn(`⚠️ Nenhuma mídia encontrada para seções: ${sectionIds.join(', ')}`);
            throw new AppNotFoundException(ErrorCode.RESOURCE_NOT_FOUND, 'Mídias associadas à galeria não encontradas');
        }
        this.logger.debug(`✅ Mídias validadas: ${media.length} mídias encontradas`);
        return media;
    }

    async upsertImagePage(
        id: string,
        pageData: UpdateImagePageDto,
        queryRunner: QueryRunner
    ): Promise<ImagePageEntity> {
        this.logger.debug(`📝 Preparando upsert da página ID: ${id}`);
        const imagePageToUpsert: Partial<ImagePageEntity> = {
            id,
            name: pageData.title,
            description: pageData.description,
            public: pageData.public,
        };
        this.logger.debug(`💾 Salvando página no banco`);
        const savedImagePage = await queryRunner.manager.save(ImagePageEntity, imagePageToUpsert);
        this.logger.debug(`✅ Galeria upsertada: ID=${savedImagePage.id}, name="${savedImagePage.name}"`);
        return savedImagePage;
    }

    async addSection(
        sectionInput: UpdateSectionDto,
        imagePage: ImagePageEntity,
        queryRunner: QueryRunner
    ): Promise<ImageSectionEntity> {
        this.logger.debug(`🆕 Preparando adição de nova seção: caption="${sectionInput.caption}"`);
        const sectionToAdd: Partial<ImageSectionEntity> = {
            caption: sectionInput.caption,
            description: sectionInput.description,
            public: sectionInput.public,
            page: imagePage,
        };
        this.logger.debug(`💾 Salvando seção no banco`);
        const savedSection = await queryRunner.manager.save(ImageSectionEntity, sectionToAdd);
        this.logger.debug(`✅ Seção adicionada: ID=${savedSection.id}`);
        return savedSection;
    }

    async deleteSections(
        existingSections: ImageSectionEntity[],
        requestedSections: UpdateSectionDto[],
        queryRunner: QueryRunner
    ): Promise<void> {
        this.logger.debug(`🗑️ Identificando seções para remoção`);
        const sectionsToRemove = existingSections.filter(
            existing => !requestedSections.some(requested => requested.id === existing.id)
        );
        this.logger.debug(`🗑️ ${sectionsToRemove.length} seções marcadas para remoção`);
        for (const section of sectionsToRemove) {
            this.logger.debug(`🗑️ Removendo seção ID: ${section.id}, caption="${section.caption}"`);
            await queryRunner.manager.remove(ImageSectionEntity, section);
            this.logger.debug(`✅ Seção removida: ID=${section.id}`);
        }
        this.logger.debug(`✅ Remoção de seções concluída`);
    }

    async deleteMedia(
        existingMedia: MediaItemEntity[],
        requestedSections: UpdateSectionDto[],
        queryRunner: QueryRunner
    ): Promise<void> {
        this.logger.debug(`🗑️ Identificando mídias para remoção`);
        const requestedMediaIds = requestedSections
            .flatMap(section => section.mediaItems.map(media => media.id))
            .filter((id): id is string => typeof id === 'string' && id.length > 0);
        this.logger.debug(`📋 IDs de mídias recebidas: ${requestedMediaIds.join(', ') || 'nenhum'}`);
        const mediaToRemove = existingMedia.filter(
            existing => existing.id && !requestedMediaIds.includes(existing.id)
        );
        this.logger.debug(`🗑️ ${mediaToRemove.length} mídias marcadas para remoção`);
        for (const media of mediaToRemove) {
            if (!media.id) {
                this.logger.warn(`⚠️ Mídia sem ID detectada, pulando exclusão: URL=${media.url || 'desconhecida'}`);
                continue;
            }
            this.logger.debug(`🗑️ Removendo mídia ID: ${media.id}, URL="${media.url || 'não fornecida'}"`);
            if (media.isLocalFile && media.url) {
                this.logger.debug(`🗑️ Removendo arquivo do S3: ${media.url}`);
                try {
                    await this.awsS3Service.delete(media.url);
                    this.logger.debug(`✅ Arquivo removido do S3: ${media.url}`);
                } catch (error) {
                    this.logger.error(`❌ Falha ao remover arquivo do S3: ${media.url}`, error.stack);
                    throw new BadRequestException(`Falha ao remover arquivo do S3: ${media.url}`);
                }
            }
            this.logger.debug(`🗑️ Removendo mídia do banco de dados`);
            await queryRunner.manager.remove(MediaItemEntity, media);
            this.logger.debug(`✅ Mídia removida do banco: ID=${media.id}`);
        }
        this.logger.debug(`✅ Remoção de mídias concluída`);
    }

    async addMedia(
        mediaInput: MediaItemDto,
        targetId: string,
        filesDict: Record<string, Express.Multer.File>,
        queryRunner: QueryRunner
    ): Promise<MediaItemEntity> {
        this.logger.debug(`🆕 Iniciando adição de mídia: fieldKey="${mediaInput.fieldKey || 'não fornecido'}"`);
        this.logger.debug(`📋 Construindo base da mídia para targetId: ${targetId}`);
        const media = this.mediaItemProcessor.buildBaseMediaItem(mediaInput, targetId, 'ImagesPage');
        if (mediaInput.isLocalFile) {
            this.logger.debug(`🔍 Verificando arquivo para upload: fieldKey=${mediaInput.fieldKey || mediaInput.url}`);
            const key = mediaInput.fieldKey ?? mediaInput.url;
            if (!key) {
                this.logger.error(`❌ Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
                throw new Error(`Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
            }
            const file = filesDict[key];
            if (!file) {
                this.logger.error(`❌ Arquivo não encontrado para chave: ${key}`);
                throw new Error(`Arquivo não encontrado para upload: ${key}`);
            }

            this.logger.debug(`📤 Iniciando upload para S3: ${file.originalname}`);
            media.url = await this.awsS3Service.upload(file);
            media.originalName = file.originalname;
            media.size = file.size;
            this.logger.debug(`✅ Upload concluído, URL: ${media.url}`);
        }
        this.logger.debug(`💾 Salvando mídia no banco`);
        const savedMedia = await queryRunner.manager.save(MediaItemEntity, media);
        this.logger.debug(`✅ Mídia adicionada: ID=${savedMedia.id}`);
        return savedMedia;
    }

    async upsertSection(
        sectionInput: UpdateSectionDto,
        imagePage: ImagePageEntity,
        queryRunner: QueryRunner
    ): Promise<ImageSectionEntity> {
        this.logger.debug(`🔄 Preparando upsert de seção ID: ${sectionInput.id}, caption="${sectionInput.caption}"`);
        const sectionToUpsert: Partial<ImageSectionEntity> = {
            id: sectionInput.id,
            caption: sectionInput.caption,
            description: sectionInput.description,
            public: sectionInput.public,
            page: imagePage,
        };
        this.logger.debug(`💾 Salvando seção no banco`);
        const savedSection = await queryRunner.manager.save(ImageSectionEntity, sectionToUpsert);
        this.logger.debug(`✅ Seção upsertada: ID=${savedSection.id}`);
        return savedSection;
    }

    async upsertMedia(
        mediaInput: MediaItemDto,
        targetId: string,
        filesDict: Record<string, Express.Multer.File>,
        queryRunner: QueryRunner
    ): Promise<MediaItemEntity> {
        this.logger.debug(`🔄 Iniciando upsert de mídia: ID=${mediaInput.id}, fieldKey="${mediaInput.fieldKey || 'não fornecido'}"`);
        this.logger.debug(`📋 Construindo base da mídia para targetId: ${targetId}`);
        const media = this.mediaItemProcessor.buildBaseMediaItem(mediaInput, targetId, 'ImagesPage');

        if (mediaInput.isLocalFile && !mediaInput.id && mediaInput.uploadType === UploadType.UPLOAD) {
            this.logger.debug(`🔍 Verificando arquivo para upload: fieldKey=${mediaInput.fieldKey || mediaInput.url}`);
            const key = mediaInput.fieldKey ?? mediaInput.url;
            if (!key) {
                this.logger.error(`❌ Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
                throw new Error(`Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
            }
            const file = filesDict[key];
            if (!file) {
                this.logger.error(`❌ Arquivo não encontrado para chave: ${key}`);
                throw new Error(`Arquivo não encontrado para upload: ${key}`);
            }

            this.logger.debug(`📤 Iniciando upload para S3: ${file.originalname}`);
            media.url = await this.awsS3Service.upload(file);
            media.originalName = file.originalname;
            media.size = file.size;
            this.logger.debug(`✅ Upload concluído, URL: ${media.url}`);
        } else {
            media.title = mediaInput.title || media.title;
            media.description = mediaInput.description || media.description;
            media.uploadType = mediaInput.uploadType || media.uploadType;
            media.platformType = mediaInput.platformType || media.platformType;
            media.mediaType = mediaInput.mediaType || media.mediaType;
            media.url = mediaInput.url?.trim() || media.url;
            media.originalName = mediaInput.originalName || media.originalName;
            media.isLocalFile = mediaInput.isLocalFile || media.isLocalFile;
            media.size = mediaInput.size || media.size;
            this.logger.debug(`🔗 Usando URL externa para imagem: "${media.url}"`);
        }

        this.logger.debug(`💾 Salvando mídia no banco`);
        const savedMedia = await queryRunner.manager.save(MediaItemEntity, { ...media, id: mediaInput.id });
        this.logger.debug(`✅ Mídia upsertada: ID=${savedMedia.id}`);
        return savedMedia;
    }

    async upsertRoute(
        routeId: string,
        pageData: UpdateImagePageDto,
        imagePageId: string
    ): Promise<RouteEntity> {
        this.logger.debug(`🛤️ Iniciando upsert da rota ID: ${routeId}`);
        const routeData: Partial<RouteEntity> = {
            title: pageData.title,
            subtitle: 'Página de galeria de imagens',
            idToFetch: imagePageId,
            entityType: MediaTargetType.ImagesPage,
            entityId: imagePageId,
            type: RouteType.PAGE,
            description: pageData.description,
            path: 'galeria_imagens_',
            image: 'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_imagens.png',
            public: pageData.public
        };

        this.logger.debug(`📋 Dados da rota preparados: title="${routeData.title}", path="${routeData.path}"`);
        this.logger.debug(`💾 Salvando rota no banco`);
        const savedRoute = await this.routeService.upsertRoute(routeId, routeData);
        this.logger.debug(`✅ Rota upsertada: ID=${savedRoute.id}, path="${savedRoute.path}"`);
        return savedRoute;
    }

    async processSectionMedia(
        mediaItems: MediaItemDto[],
        sectionId: string,
        oldMedia: MediaItemEntity[],
        filesDict: Record<string, Express.Multer.File>,
        queryRunner: QueryRunner
    ): Promise<MediaItemEntity[]> {
        this.logger.debug(`📽️ Iniciando processamento de ${mediaItems.length} mídias para seção ID: ${sectionId}`);
        const processedMedia: MediaItemEntity[] = [];
        for (const mediaInput of mediaItems) {
            this.logger.debug(`📽️ Processando mídia: id=${mediaInput.id || 'novo'}, fieldKey="${mediaInput.fieldKey || 'não fornecido'}"`);
            if (mediaInput.id) {
                this.logger.debug(`🔄 Upsertando mídia existente`);
                const savedMedia = await this.upsertMedia(mediaInput, sectionId, filesDict, queryRunner);
                processedMedia.push(savedMedia);
                this.logger.debug(`✅ Mídia upsertada: ID=${savedMedia.id}`);
            } else {
                this.logger.debug(`🆕 Adicionando nova mídia`);
                const savedMedia = await this.addMedia(mediaInput, sectionId, filesDict, queryRunner);
                processedMedia.push(savedMedia);
                this.logger.debug(`✅ Mídia adicionada: ID=${savedMedia.id}`);
            }
        }
        this.logger.debug(`✅ Processamento concluído: ${processedMedia.length} mídias`);
        return processedMedia;
    }
}
