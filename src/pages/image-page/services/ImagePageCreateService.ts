import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteEntity, RouteType } from 'src/route/route-page.entity';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaItemEntity, UploadType } from 'src/share/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { ImagePageRepository } from '../repository/image-page.repository';
import { CreateImagePageDto } from '../dto/create-image.dto';
import { ImagePageResponseDto } from '../dto/image-page-response.dto';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';

@Injectable()
export class ImagePageCreateService {
    private readonly logger = new Logger(ImagePageCreateService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly routeService: RouteService,
        private readonly awsS3Service: AwsS3Service,
        private readonly mediaItemProcessor: MediaItemProcessor,
    ) {
    }

    async createImagePage(
        pageData: CreateImagePageDto,
        filesDict: Record<string, Express.Multer.File>,
    ): Promise<ImagePageResponseDto> {
        this.logger.log(`🚀 Iniciando criação de página de imagens com título: "${pageData.title}"`);
        const { title, description, public: isPublic, sections } = pageData;

        const queryRunner = this.dataSource.createQueryRunner();
        this.logger.debug('🔗 Conectando ao QueryRunner');
        await queryRunner.connect();
        this.logger.debug('✅ QueryRunner conectado');
        this.logger.debug('🔄 Iniciando transação');
        await queryRunner.startTransaction();
        this.logger.debug('✅ Transação iniciada');

        try {
            this.logger.debug(`📝 Criando entidade da página: title="${title}"`);
            const gallery = queryRunner.manager.create(ImagePageEntity, {
                name: title,
                description,
                public: isPublic,
            });
            this.logger.debug('💾 Salvando página no banco');
            const savedGallery = await queryRunner.manager.save(gallery);
            this.logger.debug(`✅ Página salva com ID: ${savedGallery.id}`);

            this.logger.debug(`🛤️ Gerando caminho para a rota com prefixo "galeria_imagens_"`);
            const path = await this.routeService.generateAvailablePath(title, 'galeria_imagens_');
            this.logger.debug(`📝 Criando rota: path="${path}"`);
            const route = await this.routeService.createRouteWithManager(queryRunner.manager, {
                title,
                subtitle: 'Página de galeria de imagens',
                idToFetch: savedGallery.id,
                path,
                entityType: MediaTargetType.ImagesPage,
                description,
                entityId: savedGallery.id,
                type: RouteType.PAGE,
                image: 'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_imagens.png',
                public: isPublic,
            });
            this.logger.debug(`✅ Rota criada com ID: ${route.id}`);

            this.logger.debug('🔗 Associando rota à página');
            savedGallery.route = route;
            this.logger.debug('💾 Atualizando página com rota associada');
            await queryRunner.manager.save(savedGallery);
            this.logger.debug('✅ Página atualizada com rota');

            const mediaMap = new Map<string, MediaItemEntity[]>();
            const sectionList: ImageSectionEntity[] = [];

            this.logger.debug(`📂 Processando ${sections.length} seções`);
            for (const sectionInput of sections) {
                this.logger.debug(`📝 Criando seção: caption="${sectionInput.caption}"`);
                const section = queryRunner.manager.create(ImageSectionEntity, {
                    caption: sectionInput.caption,
                    description: sectionInput.description,
                    public: sectionInput.public,
                    page: savedGallery,
                });

                this.logger.debug('💾 Salvando seção no banco');
                const savedSection = await queryRunner.manager.save(section);
                sectionList.push(savedSection);
                this.logger.debug(`✅ Seção salva com ID: ${savedSection.id}`);

                this.logger.debug(`🖼️ Preparando ${sectionInput.mediaItems.length} itens de mídia para a seção`);
                const mediaItemsPrepared = sectionInput.mediaItems.map((item) => {
                    if (item.uploadType === UploadType.UPLOAD && item.isLocalFile) {
                        if (!item.originalName) {
                            this.logger.error('❌ Campo originalName ausente no item de upload');
                            throw new Error('Campo originalName ausente no item de upload.');
                        }
                        if (!item.fieldKey || !filesDict[item.fieldKey]) {
                            this.logger.error(`❌ Arquivo não encontrado para fieldKey: ${item.fieldKey}`);
                            throw new Error(`Arquivo não encontrado para fieldKey: ${item.fieldKey}`);
                        }
                    }
                    this.logger.debug(`📋 Item de mídia preparado: fieldKey="${item.fieldKey || 'não fornecido'}"`);
                    return {
                        ...item,
                        fileField: item.fieldKey,
                    };
                });

                this.logger.debug(`📤 Processando itens de mídia para seção ID: ${savedSection.id}`);
                const mediaItems = await this.mediaItemProcessor.processMediaItemsPolymorphic(
                    mediaItemsPrepared,
                    savedSection.id,
                    MediaTargetType.ImagesPage,
                    filesDict,
                    this.awsS3Service.upload.bind(this.awsS3Service),
                );
                mediaMap.set(savedSection.id, mediaItems);
                this.logger.debug(`✅ ${mediaItems.length} itens de mídia processados para seção ID: ${savedSection.id}`);
            }

            this.logger.debug('🔗 Associando seções à página');
            savedGallery.sections = sectionList;
            this.logger.debug('💾 Salvando página com seções associadas');
            const finalGallery = await queryRunner.manager.save(savedGallery);
            this.logger.debug(`✅ Página final salva com ID: ${finalGallery.id}`);

            this.logger.debug('✅ Iniciando commit da transação');
            await queryRunner.commitTransaction();
            this.logger.log(`✅ Página de imagens criada com sucesso: ID=${finalGallery.id}`);
            this.logger.debug('📤 Preparando resposta DTO');
            return ImagePageResponseDto.fromEntity(finalGallery, mediaMap);
        } catch (error) {
            this.logger.error('❌ Erro ao criar galeria. Iniciando rollback.', error);
            this.logger.debug('🔙 Executando rollback da transação');
            await queryRunner.rollbackTransaction();
            this.logger.debug('✅ Rollback concluído');
            throw new BadRequestException('Erro ao criar a galeria. Nenhum dado foi salvo.');
        } finally {
            this.logger.debug('🔚 Liberando QueryRunner');
            await queryRunner.release();
            this.logger.debug('✅ QueryRunner liberado');
        }
    }
}