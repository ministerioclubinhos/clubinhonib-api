import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { GetRouteService } from 'src/modules/routes/services/get-route.service';
import { UpdateRouteService } from 'src/modules/routes/services/update-route.service';
import { RouteEntity, RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { UpdateVideosPageDto } from '../dto/update-videos-page.dto';
import { VideosPageResponseDto } from '../dto/videos-page-response.dto';
import { GetVideosPageService } from './get-video-page.service';
import { toVideosPageResponse } from '../mappers';
import { MulterFilesDict, VideoPageContent } from '../types';
import {
  assertUploadFieldKeys,
  assertUploadFilesPresent,
  isUploadedVideo,
  normalizeIncomingVideos,
  planVideoSync,
} from '../utils';
import {
  VIDEO_PAGE_ENTITY_TYPE,
  VIDEO_PAGE_ROUTE_IMAGE_URL,
  VIDEO_PAGE_ROUTE_PATH_PREFIX,
  VIDEO_PAGE_ROUTE_SUBTITLE,
} from '../constants';

@Injectable()
export class UpdateVideosPageService {
  private readonly logger = new Logger(UpdateVideosPageService.name);

  constructor(
    private readonly videosPageRepo: VideosPageRepository,
    private readonly getService: GetVideosPageService,
    private readonly s3: AwsS3Service,
    private readonly getRouteService: GetRouteService,
    private readonly updateRouteService: UpdateRouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(
    id: string,
    dto: UpdateVideosPageDto,
    filesDict: MulterFilesDict,
  ): Promise<VideosPageResponseDto> {
    const incomingVideos = normalizeIncomingVideos(dto.videos);

    // Os uploads acontecem fora da transação da página: o rastreador permite
    // apagar do S3 o que foi enviado caso a operação falhe no meio.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.s3.upload(file),
    );

    try {
      const page = await this.getService.findEntityOrFail(id);
      const route = await this.loadRoute(page.id);
      const existingVideos = await this.getService.findVideosOf(page.id);

      await this.syncVideos(
        page.id,
        existingVideos,
        incomingVideos,
        filesDict,
        uploads,
      );

      const content: VideoPageContent = {
        name: dto.title,
        description: dto.description,
        public: dto.public,
      };

      const updatedPage = await this.videosPageRepo.runInTransaction(
        async (manager: EntityManager) => {
          page.name = content.name;
          page.description = content.description;
          page.public = content.public;
          page.route = await this.upsertRoute(route, content, page.id, manager);

          return this.videosPageRepo.savePage(page, manager);
        },
      );

      this.logger.log(`Página de vídeos atualizada. ID=${updatedPage.id}`);

      const videos = await this.getService.findVideosOf(updatedPage.id);
      return toVideosPageResponse(updatedPage, videos);
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3.delete(url),
      );

      this.logger.error(
        `Erro ao atualizar página de vídeos. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_UPDATE_ERROR,
        'Erro ao atualizar a página de vídeos.',
        error as Error,
      );
    }
  }

  private async loadRoute(pageId: string): Promise<RouteEntity> {
    const route = await this.getRouteService.findRouteByEntityId(pageId);
    if (!route) {
      throw new AppNotFoundException(
        ErrorCode.ROUTE_NOT_FOUND,
        'Rota não encontrada',
      );
    }
    return route;
  }

  private async upsertRoute(
    route: RouteEntity,
    content: VideoPageContent,
    pageId: string,
    manager: EntityManager,
  ): Promise<RouteEntity> {
    return this.updateRouteService.upsertRouteWithAvailablePath(
      route.id,
      {
        title: content.name,
        subtitle: VIDEO_PAGE_ROUTE_SUBTITLE,
        description: content.description,
        idToFetch: pageId,
        entityId: pageId,
        entityType: VIDEO_PAGE_ENTITY_TYPE,
        type: RouteType.PAGE,
        public: content.public,
        current: route.current,
        image: VIDEO_PAGE_ROUTE_IMAGE_URL,
      },
      VIDEO_PAGE_ROUTE_PATH_PREFIX,
      manager,
    );
  }

  /**
   * Aplica os vídeos recebidos: remove os que o cliente descartou, cria os
   * novos e atualiza os que mantiveram o id.
   */
  private async syncVideos(
    pageId: string,
    existingVideos: MediaItemEntity[],
    incomingVideos: MediaItemDto[],
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    const plan = planVideoSync(existingVideos, incomingVideos);

    // Só os itens novos precisam trazer o arquivo: um upload já salvo, enviado
    // sem campo multipart, mantém o objeto que está no S3.
    assertUploadFieldKeys(plan.toCreate);
    assertUploadFilesPresent(plan.toCreate, filesDict);

    if (plan.toRemove.length > 0) {
      await this.mediaItemProcessor.deleteMediaItems(
        plan.toRemove,
        (url: string) => this.s3.delete(url),
      );
      this.logger.debug(
        `${plan.toRemove.length} vídeo(s) removido(s) da página ${pageId}`,
      );
    }

    if (plan.toCreate.length > 0) {
      await this.mediaItemProcessor.processMediaItemsPolymorphic(
        plan.toCreate,
        pageId,
        VIDEO_PAGE_ENTITY_TYPE,
        filesDict,
        uploads.upload,
      );
    }

    if (plan.toUpdate.length === 0) return;

    const existingById = new Map(
      existingVideos.map((item) => [item.id, item] as const),
    );

    for (const item of plan.toUpdate) {
      await this.updateExistingVideo(
        item,
        existingById,
        pageId,
        filesDict,
        uploads,
      );
    }
  }

  private async updateExistingVideo(
    item: MediaItemDto,
    existingById: ReadonlyMap<string, MediaItemEntity>,
    pageId: string,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<MediaItemEntity> {
    const previous = item.id ? existingById.get(item.id) : undefined;
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      item,
      pageId,
      VIDEO_PAGE_ENTITY_TYPE,
    );

    const file = item.fileField ? filesDict[item.fileField] : undefined;

    if (isUploadedVideo(item) && file) {
      media.url = await uploads.upload(file);
      media.isLocalFile = true;
      media.originalName = file.originalname;
      media.size = file.size;
      media.platformType = undefined;
    } else {
      // Sem arquivo novo, o objeto já guardado no S3 é preservado.
      media.url = item.url?.trim() || previous?.url || '';
      media.isLocalFile = item.isLocalFile ?? previous?.isLocalFile ?? false;
      media.originalName = item.originalName || previous?.originalName || '';
      media.size = item.size ?? previous?.size ?? 0;
      media.platformType = item.platformType ?? previous?.platformType;
    }

    const saved = await this.mediaItemProcessor.upsertMediaItem(item.id, media);

    // O arquivo antigo só sai depois que o registro já aponta para o novo: na
    // ordem inversa, uma falha no upload deixaria a mídia sem arquivo nenhum.
    if (previous?.isLocalFile && previous.url && previous.url !== saved.url) {
      await this.s3.delete(previous.url);
    }

    return saved;
  }
}
