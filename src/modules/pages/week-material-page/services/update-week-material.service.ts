import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteEntity, RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { WeekMaterialsPageRepository } from '../repositories/week-material-page.repository';
import { UpdateWeekMaterialsPageDto } from '../dto/update-week-material.dto';
import { WeekMaterialsPageResponseDTO } from '../dto/week-material-response.dto';
import { WeekMaterialsPageGetService } from './get-week-material.service';
import { toWeekMaterialsPageResponse } from '../mappers';
import { MulterFilesDict, WeekMaterialPageContent } from '../types';
import {
  assertUploadFieldKeys,
  assertUploadFilesPresent,
  isUploadedMedia,
  normalizeIncomingMedia,
  planMediaSync,
  resolveUploadedFile,
} from '../utils';
import {
  WEEK_MATERIAL_ENTITY_TYPE,
  WEEK_MATERIAL_ROUTE_IMAGE_URL,
  WEEK_MATERIAL_ROUTE_PATH_PREFIX,
} from '../constants';

@Injectable()
export class WeekMaterialsPageUpdateService {
  private readonly logger = new Logger(WeekMaterialsPageUpdateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly pageRepo: WeekMaterialsPageRepository,
    private readonly getService: WeekMaterialsPageGetService,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async updateWeekMaterialsPage(
    id: string,
    dto: UpdateWeekMaterialsPageDto,
    filesDict: MulterFilesDict,
  ): Promise<WeekMaterialsPageResponseDTO> {
    const incomingMedia = normalizeIncomingMedia(dto);

    // Os uploads acontecem fora da transação da página: o rastreador permite
    // apagar do S3 o que foi enviado caso a operação falhe no meio.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.s3.upload(file),
    );

    try {
      const page = await this.getService.findOnePage(id);
      const route = await this.loadRoute(page.id);
      const existingMedia = await this.getService.findMediaOfPage(page.id);

      await this.syncMedia(
        page.id,
        existingMedia,
        incomingMedia,
        filesDict,
        uploads,
      );

      const content: WeekMaterialPageContent = {
        title: dto.pageTitle,
        subtitle: dto.pageSubtitle,
        description: dto.pageDescription,
        currentWeek: dto.currentWeek ?? page.currentWeek ?? false,
      };

      const updatedPage = await this.dataSource.transaction(
        async (manager: EntityManager) => {
          const savedRoute = await this.upsertRoute(
            route,
            content,
            page.id,
            manager,
          );

          page.title = content.title;
          page.subtitle = content.subtitle;
          page.description = content.description;
          page.currentWeek = content.currentWeek;
          page.route = savedRoute;

          return this.pageRepo.savePage(page, manager);
        },
      );

      this.logger.log(`Página de materiais atualizada. ID=${updatedPage.id}`);

      const mediaItems = await this.getService.findMediaOfPage(updatedPage.id);
      return toWeekMaterialsPageResponse(updatedPage, mediaItems);
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3.delete(url),
      );

      this.logger.error(
        `Erro ao atualizar página de materiais. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_UPDATE_ERROR,
        'Erro ao atualizar a página de materiais',
        error as Error,
      );
    }
  }

  /** Publishes a page as the current week material, clearing the previous one. */
  async setCurrentWeek(id: string): Promise<WeekMaterialsPageResponseDTO> {
    const page = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const target = await this.pageRepo.findOnePageById(id, manager);
        if (!target) {
          throw new AppNotFoundException(
            ErrorCode.WEEK_MATERIAL_NOT_FOUND,
            `Página com ID ${id} não encontrada.`,
          );
        }

        const previous = await this.pageRepo.findCurrentWeek(manager);
        if (previous && previous.id !== target.id) {
          previous.currentWeek = false;
          previous.route.current = false;
          await this.pageRepo.savePage(previous, manager);
        }

        target.currentWeek = true;
        target.route.current = true;
        target.route.public = true;

        return this.pageRepo.savePage(target, manager);
      },
    );

    this.logger.log(`Página definida como material da semana. ID=${page.id}`);

    const mediaItems = await this.getService.findMediaOfPage(page.id);
    return toWeekMaterialsPageResponse(page, mediaItems);
  }

  private async loadRoute(pageId: string): Promise<RouteEntity> {
    const route = await this.routeService.findRouteByEntityId(pageId);
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
    content: WeekMaterialPageContent,
    pageId: string,
    manager: EntityManager,
  ): Promise<RouteEntity> {
    return this.routeService.upsertRouteWithAvailablePath(
      route.id,
      {
        title: content.title,
        subtitle: content.subtitle,
        description: content.description,
        idToFetch: pageId,
        entityType: WEEK_MATERIAL_ENTITY_TYPE,
        entityId: pageId,
        public: route.public,
        current: route.current,
        type: RouteType.PAGE,
        image: WEEK_MATERIAL_ROUTE_IMAGE_URL,
      },
      WEEK_MATERIAL_ROUTE_PATH_PREFIX,
      manager,
    );
  }

  /**
   * Applies the incoming media to the page: removes what the client dropped,
   * creates the new items and refreshes the ones that kept their id.
   */
  private async syncMedia(
    pageId: string,
    existingMedia: MediaItemEntity[],
    incomingMedia: MediaItemDto[],
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    const plan = planMediaSync(existingMedia, incomingMedia);

    // Only new items must carry their file: an existing upload sent without a
    // multipart field keeps the object already stored in S3.
    assertUploadFieldKeys(plan.toCreate);
    assertUploadFilesPresent(plan.toCreate, filesDict);

    if (plan.toRemove.length > 0) {
      await this.mediaItemProcessor.deleteMediaItems(
        plan.toRemove,
        (url: string) => this.s3.delete(url),
      );
      this.logger.debug(
        `${plan.toRemove.length} mídia(s) removida(s) da página ${pageId}`,
      );
    }

    if (plan.toCreate.length > 0) {
      await this.mediaItemProcessor.processMediaItemsPolymorphic(
        plan.toCreate,
        pageId,
        WEEK_MATERIAL_ENTITY_TYPE,
        filesDict,
        uploads.upload,
      );
    }

    if (plan.toUpdate.length === 0) return;

    const existingById = new Map(
      existingMedia.map((item) => [item.id, item] as const),
    );

    for (const item of plan.toUpdate) {
      await this.updateExistingMedia(
        item,
        existingById,
        pageId,
        filesDict,
        uploads,
      );
    }
  }

  private async updateExistingMedia(
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
      WEEK_MATERIAL_ENTITY_TYPE,
    );

    if (isUploadedMedia(item) && item.fileField) {
      const file = resolveUploadedFile(item, filesDict);
      media.url = await uploads.upload(file);
      media.isLocalFile = true;
      media.originalName = file.originalname;
      media.size = file.size;
      media.platformType = undefined;
    } else {
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
