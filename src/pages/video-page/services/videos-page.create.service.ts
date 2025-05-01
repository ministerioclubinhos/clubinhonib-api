import {
    BadRequestException,
    Injectable,
    Logger,
  } from '@nestjs/common';
  import { DataSource } from 'typeorm';
  import { AwsS3Service } from 'src/aws/aws-s3.service';
  import { RouteService } from 'src/route/route.service';
  import { RouteType } from 'src/route/route-page.entity';
  import { PlatformType, MediaType, UploadType } from 'src/share/media/media-item/media-item.entity';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { VideosPageRepository } from '../video-page.repository';
  import { CreateVideosPageDto } from '../dto/create-videos-page.dto';
  import { VideosPage } from '../entities/video-page.entity';
  import { VideosPageResponseDto } from '../dto/videos-page-response.dto';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
  
  @Injectable()
  export class CreateVideosPageService {
    private readonly logger = new Logger(CreateVideosPageService.name);
  
    constructor(
      private readonly dataSource: DataSource,
      private readonly routeService: RouteService,
      private readonly awsS3Service: AwsS3Service,
      private readonly mediaItemProcessor: MediaItemProcessor,
      private readonly videosPageRepo: VideosPageRepository,
    ) {}
  
    async execute(
      dto: CreateVideosPageDto,
      filesDict: Record<string, Express.Multer.File>,
    ): Promise<VideosPageResponseDto> {
      const { title, description, public: isPublic, videos } = dto;
      this.logger.debug(`🔍 Iniciando criação da página de vídeos: "${title}"`);
  
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
  
      try {
        const newPage = queryRunner.manager.create(VideosPage, {
          name: title,
          description,
          public: isPublic,
        });
        const savedPage = await queryRunner.manager.save(newPage);
  
        const path = await this.routeService.generateAvailablePath(title, 'galeria_videos_');
        const route = await this.routeService.createRouteWithManager(queryRunner.manager, {
          title,
          subtitle: 'Página de galeria de vídeos',
          idToFetch: savedPage.id,
          path,
          entityType: MediaTargetType.VideosPage,
          entityId: savedPage.id,
          type: RouteType.PAGE,
          description,
          image: 'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_videos.png',
          public: isPublic,
        });
  
        savedPage.route = route;
  
        const mediaItems = await this.mediaItemProcessor.processMediaItemsPolymorphic(
          videos.map((video) => ({
            ...video,
            mediaType: MediaType.VIDEO,
            uploadType: video.uploadType as UploadType,
            platformType: video.platformType as PlatformType,
            fileField: video.fieldKey,
          })),
          savedPage.id,
          MediaTargetType.VideosPage,
          filesDict,
          this.awsS3Service.upload.bind(this.awsS3Service),
        );
  
        const finalPage = await queryRunner.manager.save(savedPage);
        await queryRunner.commitTransaction();
        return VideosPageResponseDto.fromEntity(finalPage, mediaItems);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('❌ Erro ao criar página de vídeos. Rollback executado.', error);
        throw new BadRequestException('Erro ao criar a página de vídeos.');
      } finally {
        await queryRunner.release();
      }
    }
  }
  