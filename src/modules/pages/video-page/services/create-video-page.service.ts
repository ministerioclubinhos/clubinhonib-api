import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { CreateVideosPageDto } from '../dto/create-videos-page.dto';
import { VideosPageResponseDto } from '../dto/videos-page-response.dto';
import { VideosPage } from '../entities/video-page.entity';
import { toVideosPageResponse } from '../mappers';
import { MulterFilesDict } from '../types';
import {
  assertUploadFieldKeys,
  assertUploadFilesPresent,
  normalizeIncomingVideos,
} from '../utils';
import {
  VIDEO_PAGE_ENTITY_TYPE,
  VIDEO_PAGE_ROUTE_IMAGE_URL,
  VIDEO_PAGE_ROUTE_PATH_PREFIX,
  VIDEO_PAGE_ROUTE_SUBTITLE,
} from '../constants';

@Injectable()
export class CreateVideosPageService {
  private readonly logger = new Logger(CreateVideosPageService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly videosPageRepo: VideosPageRepository,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(
    dto: CreateVideosPageDto,
    filesDict: MulterFilesDict,
  ): Promise<VideosPageResponseDto> {
    const incomingVideos = normalizeIncomingVideos(dto.videos);
    assertUploadFieldKeys(incomingVideos);
    assertUploadFilesPresent(incomingVideos, filesDict);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedPage: VideosPage | null = null;

    // Cada arquivo enviado fica registrado: se a criação falhar depois do
    // upload, o objeto é apagado do bucket em vez de ficar órfão.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.s3.upload(file),
    );

    try {
      savedPage = await this.persistPageWithRoute(dto, queryRunner.manager);

      const videos = await this.mediaItemProcessor.processMediaItemsPolymorphic(
        incomingVideos,
        savedPage.id,
        VIDEO_PAGE_ENTITY_TYPE,
        filesDict,
        uploads.upload,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Página de vídeos criada. ID=${savedPage.id}`);

      return toVideosPageResponse(savedPage, videos);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      await this.discardOrphanMedia(savedPage?.id);
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3.delete(url),
      );

      this.logger.error(
        'Erro ao criar página de vídeos. Rollback executado.',
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_CREATE_ERROR,
        'Erro ao criar a página de vídeos.',
        error as Error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async persistPageWithRoute(
    dto: CreateVideosPageDto,
    manager: EntityManager,
  ): Promise<VideosPage> {
    const page = await this.videosPageRepo.createPage(
      {
        name: dto.title,
        description: dto.description,
        public: dto.public,
      },
      manager,
    );

    const path = await this.routeService.generateAvailablePath(
      dto.title,
      VIDEO_PAGE_ROUTE_PATH_PREFIX,
    );

    page.route = await this.routeService.createRouteWithManager(manager, {
      title: dto.title,
      subtitle: VIDEO_PAGE_ROUTE_SUBTITLE,
      description: dto.description,
      path,
      idToFetch: page.id,
      entityId: page.id,
      entityType: VIDEO_PAGE_ENTITY_TYPE,
      type: RouteType.PAGE,
      image: VIDEO_PAGE_ROUTE_IMAGE_URL,
      public: dto.public,
    });

    return this.videosPageRepo.savePage(page, manager);
  }

  /**
   * As mídias são gravadas fora da transação da página: no rollback, apagar o
   * que já foi persistido evita registro e arquivo órfãos.
   */
  private async discardOrphanMedia(pageId?: string): Promise<void> {
    if (!pageId) return;

    try {
      const orphans: MediaItemEntity[] =
        await this.mediaItemProcessor.findMediaItemsByTarget(
          pageId,
          VIDEO_PAGE_ENTITY_TYPE,
        );
      if (orphans.length === 0) return;

      await this.mediaItemProcessor.deleteMediaItems(orphans, (url: string) =>
        this.s3.delete(url),
      );
      this.logger.warn(
        `Compensação executada: ${orphans.length} mídia(s) órfã(s) removida(s). pageId=${pageId}`,
      );
    } catch (cleanupError: unknown) {
      this.logger.error(
        `Falha ao remover mídias órfãs da página ${pageId}`,
        cleanupError instanceof Error ? cleanupError.stack : undefined,
      );
    }
  }
}
