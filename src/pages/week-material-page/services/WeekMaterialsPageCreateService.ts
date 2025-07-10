import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteType } from 'src/route/route-page.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { WeekMaterialsPageRepository } from '../week-material.repository';
import { MediaItemEntity, MediaType, UploadType } from 'src/share/media/media-item/media-item.entity';
import { CreateWeekMaterialsPageDto } from '../dto/create-week-material.dto';
import { WeekMaterialsPageResponseDTO } from '../dto/week-material-response.dto';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

@Injectable()
export class WeekMaterialsPageCreateService {
  private readonly logger = new Logger(WeekMaterialsPageCreateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly repo: WeekMaterialsPageRepository,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  async createWeekMaterialsPage(
    dto: CreateWeekMaterialsPageDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`🚧 Criando nova página: "${dto.pageTitle}"`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedPage: WeekMaterialsPageEntity;
    let mediaItems: MediaItemEntity[] = [];

    try {
      const page = queryRunner.manager.create(WeekMaterialsPageEntity, {
        title: dto.pageTitle,
        subtitle: dto.pageSubtitle,
        description: dto.pageDescription,
      });
      savedPage = await queryRunner.manager.save(page);
      this.logger.debug(`💾 Página salva. ID=${savedPage.id}`);

      const path = await this.routeService.generateAvailablePath(dto.pageTitle, 'materiais_semanal_');
      const route = await this.routeService.createRouteWithManager(queryRunner.manager, {
        title: dto.pageTitle,
        subtitle: dto.pageSubtitle,
        description: dto.pageDescription,
        path,
        type: RouteType.PAGE,
        entityId: savedPage.id,
        idToFetch: savedPage.id,
        entityType: 'WeekMaterialsPage',
        image: 'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_materiais.png',
        public: true,
        current: false
      });
      this.logger.debug(`🛤️ Rota criada. ID=${route.id}`);

      savedPage.route = route;
      await queryRunner.manager.save(savedPage);

      const adjustedMediaItems = this.mergeAndFixMedia({
        videos: dto.videos || [],
        documents: dto.documents || [],
        images: dto.images || [],
        audios: dto.audios || [],
      });
      this.logger.debug(`Itens de mídia ajustados: ${JSON.stringify(adjustedMediaItems)}`);

      mediaItems = await this.mediaItemProcessor.processMediaItemsPolymorphic(
        adjustedMediaItems,
        savedPage.id,
        MediaTargetType.WeekMaterialsPage,
        filesDict,
        this.s3.upload.bind(this.s3),
      );

      await queryRunner.commitTransaction();
      this.logger.debug(`✅ Página criada com sucesso. ID=${savedPage.id}`);

      return WeekMaterialsPageResponseDTO.fromEntity(savedPage, mediaItems);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao criar página. Rollback executado.', error);
      throw new BadRequestException(`Erro ao criar a página de materiais: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  private mergeAndFixMedia(dto: {
    videos: MediaItemDto[];
    documents: MediaItemDto[];
    images: MediaItemDto[];
    audios: MediaItemDto[];
  }): MediaItemDto[] {

    const videos = (dto.videos || []).map((media) => ({
      ...media,
      mediaType: MediaType.VIDEO,
      fileField: media.uploadType === UploadType.UPLOAD && media.isLocalFile ? media.fieldKey : undefined,
    }));
    const documents = (dto.documents || []).map((media) => ({
      ...media,
      mediaType: MediaType.DOCUMENT,
      fileField: media.uploadType === UploadType.UPLOAD && media.isLocalFile ? media.fieldKey : undefined,
    }));
    const images = (dto.images || []).map((media) => ({
      ...media,
      mediaType: MediaType.IMAGE,
      fileField:  media.uploadType === UploadType.UPLOAD && media.isLocalFile ? media.fieldKey : undefined,
    }));
    const audios = (dto.audios || []).map((media) => ({
      ...media,
      mediaType: MediaType.AUDIO,
      fileField:  media.uploadType === UploadType.UPLOAD && media.isLocalFile ? media.fieldKey : undefined,
    }));

    const mediaItems = [...videos, ...documents, ...images, ...audios];

    mediaItems.forEach((item) => {
      if ( item.uploadType === UploadType.UPLOAD && item.isLocalFile && !item.fileField) {
        throw new BadRequestException(`fieldKey ausente para item de mídia: ${item.title}`);
      }
    });

    return mediaItems;
  }
}