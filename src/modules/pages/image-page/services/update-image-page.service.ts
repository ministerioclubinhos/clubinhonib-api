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
import {
  MediaItemEntity,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { UpdateImagePageDto, UpdateSectionDto } from '../dto/update-image.dto';
import { ImagePageResponseDto } from '../dto/image-page-response.dto';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImagePageGetService } from './get-image-page.service';
import { toImagePageResponse } from '../mappers';
import { collectSectionIds, planSectionSync } from '../utils';
import { MulterFilesDict } from '../types';
import {
  IMAGE_PAGE_ENTITY_TYPE,
  IMAGE_PAGE_ROUTE_IMAGE_URL,
  IMAGE_PAGE_ROUTE_PATH_PREFIX,
  IMAGE_PAGE_ROUTE_SUBTITLE,
} from '../constants';

@Injectable()
export class ImagePageUpdateService {
  private readonly logger = new Logger(ImagePageUpdateService.name);

  constructor(
    private readonly imagePageRepository: ImagePageRepository,
    private readonly getService: ImagePageGetService,
    private readonly getRouteService: GetRouteService,
    private readonly updateRouteService: UpdateRouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async updateImagePage(
    id: string,
    dto: UpdateImagePageDto,
    filesDict: MulterFilesDict,
  ): Promise<ImagePageResponseDto> {
    // Os uploads acontecem fora da transação da galeria: o rastreador permite
    // apagar do S3 o que foi enviado caso a operação falhe no meio.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      const page = await this.getService.findEntityOrFail(id);
      const route = await this.loadRoute(page.id);

      await this.syncSections(page, dto.sections, filesDict, uploads);

      const updatedPage = await this.imagePageRepository.runInTransaction(
        async (manager: EntityManager) => {
          // A galeria carregada trouxe as seções antigas, e a relação tem
          // `cascade`: salvar essa instância regravava as seções que a
          // sincronização acabou de renomear ou remover, desfazendo a edição.
          // A gravação parte de uma leitura sem as seções.
          const target =
            (await this.imagePageRepository.findById(page.id, manager)) ?? page;
          target.name = dto.title;
          target.description = dto.description;
          target.public = dto.public;
          target.route = await this.upsertRoute(route, dto, page.id, manager);

          return this.imagePageRepository.savePage(target, manager);
        },
      );

      this.logger.log(`Galeria atualizada. ID=${updatedPage.id}`);

      const reloaded =
        (await this.imagePageRepository.findByIdWithSections(updatedPage.id)) ??
        updatedPage;
      const mediaBySection = await this.getService.findMediaOfSections(
        collectSectionIds([reloaded]),
      );

      return toImagePageResponse(reloaded, mediaBySection);
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      this.logger.error(
        `Erro ao atualizar galeria. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_UPDATE_ERROR,
        'Erro ao atualizar a galeria',
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
    dto: UpdateImagePageDto,
    pageId: string,
    manager: EntityManager,
  ): Promise<RouteEntity> {
    return this.updateRouteService.upsertRouteWithAvailablePath(
      route.id,
      {
        title: dto.title,
        subtitle: IMAGE_PAGE_ROUTE_SUBTITLE,
        description: dto.description,
        idToFetch: pageId,
        entityId: pageId,
        entityType: IMAGE_PAGE_ENTITY_TYPE,
        type: RouteType.PAGE,
        public: dto.public,
        current: route.current,
        image: IMAGE_PAGE_ROUTE_IMAGE_URL,
      },
      IMAGE_PAGE_ROUTE_PATH_PREFIX,
      manager,
    );
  }

  /**
   * Aplica as seções recebidas: remove as que sumiram do payload, atualiza as
   * que mantiveram o id e cria o restante.
   */
  private async syncSections(
    page: ImagePageEntity,
    incoming: UpdateSectionDto[],
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    const existing = page.sections ?? [];
    const plan = planSectionSync(existing, incoming);

    await this.removeSections(plan.toRemove);

    for (const section of plan.toUpdate) {
      await this.updateSection(section, filesDict, uploads);
    }

    for (const section of plan.toCreate) {
      await this.createSection(page, section, filesDict, uploads);
    }
  }

  /** Remove as seções e tudo que pendurava nelas: mídias e arquivos no S3. */
  private async removeSections(sectionIds: string[]): Promise<void> {
    if (sectionIds.length === 0) return;

    const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      sectionIds,
      IMAGE_PAGE_ENTITY_TYPE,
    );

    if (media.length > 0) {
      await this.mediaItemProcessor.deleteMediaItems(media, (url: string) =>
        this.awsS3Service.delete(url),
      );
    }

    await this.imagePageRepository.removeSectionsByIds(sectionIds);
    this.logger.debug(`${sectionIds.length} seção(ões) removida(s)`);
  }

  private async updateSection(
    input: UpdateSectionDto,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    const section = await this.imagePageRepository.findSectionById(
      input.id as string,
    );
    if (!section) {
      this.logger.warn(`Seção não encontrada, ignorada. ID=${input.id}`);
      return;
    }

    section.caption = input.caption;
    section.description = input.description;
    section.public = input.public;
    await this.imagePageRepository.saveSection(section);

    await this.syncSectionMedia(
      section.id,
      input.mediaItems,
      filesDict,
      uploads,
    );
  }

  private async createSection(
    page: ImagePageEntity,
    input: UpdateSectionDto,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    const section = await this.imagePageRepository.createSection(page, {
      caption: input.caption,
      description: input.description,
      public: input.public,
    });

    await this.mediaItemProcessor.processMediaItemsPolymorphic(
      input.mediaItems.map((item) => ({ ...item, fileField: item.fieldKey })),
      section.id,
      IMAGE_PAGE_ENTITY_TYPE,
      filesDict,
      uploads.upload,
    );
  }

  /**
   * Mesma diferenciação das seções, agora para as mídias: o que saiu do payload
   * é apagado, o que tem id é atualizado e o resto é criado.
   */
  private async syncSectionMedia(
    sectionId: string,
    incoming: MediaItemDto[],
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    const existing = await this.mediaItemProcessor.findMediaItemsByTarget(
      sectionId,
      IMAGE_PAGE_ENTITY_TYPE,
    );

    const incomingIds = new Set(
      incoming.map((item) => item.id).filter((id): id is string => Boolean(id)),
    );
    const toRemove = existing.filter((item) => !incomingIds.has(item.id));

    if (toRemove.length > 0) {
      await this.mediaItemProcessor.deleteMediaItems(toRemove, (url: string) =>
        this.awsS3Service.delete(url),
      );
    }

    const toCreate = incoming.filter((item) => !item.id);
    if (toCreate.length > 0) {
      await this.mediaItemProcessor.processMediaItemsPolymorphic(
        toCreate.map((item) => ({ ...item, fileField: item.fieldKey })),
        sectionId,
        IMAGE_PAGE_ENTITY_TYPE,
        filesDict,
        uploads.upload,
      );
    }

    const existingById = new Map(existing.map((item) => [item.id, item]));
    for (const item of incoming.filter((media) => Boolean(media.id))) {
      await this.updateMediaItem(
        item,
        existingById,
        sectionId,
        filesDict,
        uploads,
      );
    }
  }

  private async updateMediaItem(
    item: MediaItemDto,
    existingById: ReadonlyMap<string, MediaItemEntity>,
    sectionId: string,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<MediaItemEntity> {
    const previous = item.id ? existingById.get(item.id) : undefined;
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      item,
      sectionId,
      IMAGE_PAGE_ENTITY_TYPE,
    );

    const isUpload =
      item.uploadType === UploadType.UPLOAD || item.isLocalFile === true;
    const file = item.fieldKey ? filesDict[item.fieldKey] : undefined;

    if (isUpload && file) {
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
      await this.awsS3Service.delete(previous.url);
    }

    return saved;
  }
}
