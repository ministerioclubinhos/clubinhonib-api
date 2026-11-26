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
import { assertOwnedUniqueIds } from 'src/shared/media/payload-validation';
import { SyncPlayEntriesService } from 'src/modules/play/services/sync-play-entries.service';
import { GetPlayVideosService } from 'src/modules/play/services/get-play-videos.service';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { UpdateVideosPageDto } from '../dto/update-videos-page.dto';
import { VideosPageResponseDto } from '../dto/videos-page-response.dto';
import { GetVideosPageService } from './get-video-page.service';
import { toVideosPageResponse } from '../mappers';
import { MulterFilesDict, VideoPageContent } from '../types';
import {
  assertUploadFieldKeys,
  assertUploadFilesPresent,
  assertVideoLinks,
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
    private readonly syncPlay: SyncPlayEntriesService,
    private readonly playService: GetPlayVideosService,
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
    // Arquivos que deixam de ser referenciados; apagados só após o commit.
    const removedUrls: string[] = [];

    try {
      const page = await this.getService.findEntityOrFail(id);
      const route = await this.loadRoute(page.id);
      const existingVideos = await this.getService.findVideosOf(page.id);

      // Valida tudo antes da primeira escrita: depois dela, uma recusa deixaria
      // a página pela metade.
      assertOwnedUniqueIds(
        incomingVideos,
        existingVideos,
        'vídeo',
        (index) => ({
          field: `videos.${index}.id`,
          label: `Vídeo ${index + 1}`,
        }),
      );
      assertVideoLinks(incomingVideos);
      const playCategoryId = await this.syncPlay.validate(
        dto.play,
        incomingVideos,
        filesDict,
        page.playCategoryId ?? null,
      );
      this.assertFilesForNewUploads(incomingVideos, existingVideos, filesDict);

      const content: VideoPageContent = {
        name: dto.title,
        description: dto.description,
        public: dto.public,
      };

      const updatedPage = await this.videosPageRepo.runInTransaction(
        async (manager: EntityManager) => {
          // Vídeos, rota e dados da página entram na mesma transação: uma
          // falha em qualquer ponto desfaz tudo, sem página pela metade.
          const created = await this.syncVideos(
            page.id,
            incomingVideos,
            filesDict,
            uploads,
            manager,
            removedUrls,
          );

          if (dto.play) {
            // Ids na ordem do payload: o existente ou o da mídia recém-criada.
            let next = 0;
            const mediaIds = incomingVideos.map(
              (video) => video.id ?? created[next++].id,
            );
            const played = await this.syncPlay.execute(
              page.id,
              dto.play.scope,
              mediaIds,
              incomingVideos,
              manager,
              filesDict,
              uploads.upload,
            );
            removedUrls.push(...played.removedUrls);
            page.playScope = dto.play.scope;
            page.playCategoryId = playCategoryId;
          }

          page.name = content.name;
          page.description = content.description;
          page.public = content.public;
          page.route = await this.upsertRoute(route, content, page.id, manager);

          return this.videosPageRepo.savePage(page, manager);
        },
      );

      // Arquivos removidos ou substituídos só saem do S3 depois do commit: se a
      // transação desfizesse, o banco ainda apontaria para eles.
      await this.mediaItemProcessor.discardUnreferencedUploads(
        removedUrls,
        (url: string) => this.s3.delete(url),
      );

      this.logger.log(`Página de vídeos atualizada. ID=${updatedPage.id}`);

      const videos = await this.getService.findVideosOf(updatedPage.id);
      const entries = await this.playService.findEntriesOf(updatedPage.id);
      return toVideosPageResponse(updatedPage, videos, entries);
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
   * Só os vídeos novos e os links que viram upload precisam trazer o arquivo:
   * um upload já salvo, enviado sem campo multipart, mantém o objeto no S3.
   * Roda antes da primeira escrita.
   */
  private assertFilesForNewUploads(
    incoming: MediaItemDto[],
    existing: MediaItemEntity[],
    filesDict: MulterFilesDict,
  ): void {
    const existingById = new Map(existing.map((item) => [item.id, item]));
    const needsFile = incoming.filter(
      (item) => !item.id || !existingById.get(item.id)?.isLocalFile,
    );
    assertUploadFieldKeys(needsFile.filter((item) => !item.id));
    assertUploadFilesPresent(needsFile, filesDict);
  }

  /**
   * Aplica os vídeos recebidos dentro da transação em curso: remove os que o
   * cliente descartou, cria os novos e atualiza os que mantiveram o id.
   */
  private async syncVideos(
    pageId: string,
    incomingVideos: MediaItemDto[],
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<MediaItemEntity[]> {
    const existingVideos =
      await this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
        manager,
        pageId,
        VIDEO_PAGE_ENTITY_TYPE,
      );
    const plan = planVideoSync(existingVideos, incomingVideos);

    for (const item of plan.toRemove) {
      await this.mediaItemProcessor.deleteMediaItemByIdInTransaction(
        manager,
        item.id,
      );
      if (item.isLocalFile) removedUrls.push(item.url);
    }
    if (plan.toRemove.length > 0) {
      this.logger.debug(
        `${plan.toRemove.length} vídeo(s) removido(s) da página ${pageId}`,
      );
    }

    let created: MediaItemEntity[] = [];
    if (plan.toCreate.length > 0) {
      created = await this.mediaItemProcessor.processMediaItemsPolymorphic(
        plan.toCreate,
        pageId,
        VIDEO_PAGE_ENTITY_TYPE,
        filesDict,
        uploads.upload,
        manager,
      );
    }

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
        manager,
        removedUrls,
      );
    }

    return created;
  }

  private async updateExistingVideo(
    item: MediaItemDto,
    existingById: ReadonlyMap<string, MediaItemEntity>,
    pageId: string,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
    removedUrls: string[],
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
    } else if (isUploadedVideo(item) && previous?.isLocalFile) {
      // O arquivo já guardado não pode ser redirecionado pelo cliente: URL,
      // nome e tamanho vêm do registro, não do payload.
      media.url = previous.url;
      media.isLocalFile = true;
      media.originalName = previous.originalName;
      media.size = previous.size;
      media.platformType = undefined;
    } else {
      // Link: nada de arquivo guardado.
      media.url = item.url?.trim() || '';
      media.isLocalFile = false;
      media.originalName = '';
      media.size = 0;
      media.platformType = item.platformType ?? previous?.platformType;
    }

    if (previous) media.id = previous.id;
    const saved = await this.mediaItemProcessor.saveMediaItemInTransaction(
      manager,
      media,
    );

    // O arquivo antigo só sai do S3 depois do commit.
    if (previous?.isLocalFile && previous.url && previous.url !== saved.url) {
      removedUrls.push(previous.url);
    }

    return saved;
  }
}
