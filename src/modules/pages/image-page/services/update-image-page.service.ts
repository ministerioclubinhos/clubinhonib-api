import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  AppNotFoundException,
  AppValidationException,
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
import { assertOwnedUniqueIds } from 'src/shared/media/payload-validation';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { UpdateImagePageDto, UpdateSectionDto } from '../dto/update-image.dto';
import { ImagePageResponseDto } from '../dto/image-page-response.dto';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImagePageGetService } from './get-image-page.service';
import { toImagePageResponse } from '../mappers';
import {
  assertNewUploadsHaveFiles,
  assertSectionMediaLinks,
  collectSectionIds,
  planSectionSync,
} from '../utils';
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
    // Arquivos que deixam de ser referenciados; apagados só após o commit.
    const removedUrls: string[] = [];

    try {
      const page = await this.getService.findEntityOrFail(id);
      const route = await this.loadRoute(page.id);

      // Valida tudo antes da primeira escrita: depois dela, uma recusa deixaria
      // a galeria pela metade.
      assertOwnedUniqueIds(
        dto.sections,
        page.sections ?? [],
        'seção',
        (index) => ({
          field: `sections.${index}.id`,
          label: `Seção ${index + 1}`,
        }),
      );
      assertNewUploadsHaveFiles(
        dto.sections.flatMap((section) => section.mediaItems),
        filesDict,
      );
      assertSectionMediaLinks(dto.sections);

      const updatedPage = await this.imagePageRepository.runInTransaction(
        async (manager: EntityManager) => {
          // Seções, imagens, rota e dados da galeria entram na mesma transação:
          // uma falha em qualquer ponto desfaz tudo, sem galeria pela metade.
          await this.syncSections(
            page,
            dto.sections,
            filesDict,
            uploads,
            manager,
            removedUrls,
          );

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

      // Arquivos removidos ou substituídos só saem do S3 depois do commit: se a
      // transação desfizesse, o banco ainda apontaria para eles.
      await this.mediaItemProcessor.discardUnreferencedUploads(
        removedUrls,
        (url: string) => this.awsS3Service.delete(url),
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
   * que mantiveram o id e cria o restante. Tudo dentro da transação em curso.
   */
  private async syncSections(
    page: ImagePageEntity,
    incoming: UpdateSectionDto[],
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<void> {
    const plan = planSectionSync(page.sections ?? [], incoming);

    await this.removeSections(plan.toRemove, manager, removedUrls);

    for (const section of plan.toUpdate) {
      await this.updateSection(
        section,
        filesDict,
        uploads,
        manager,
        removedUrls,
      );
    }

    for (const section of plan.toCreate) {
      await this.createSection(page, section, filesDict, uploads, manager);
    }
  }

  /** Remove as seções e tudo que pendurava nelas: mídias e arquivos no S3. */
  private async removeSections(
    sectionIds: string[],
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<void> {
    if (sectionIds.length === 0) return;

    for (const sectionId of sectionIds) {
      const media =
        await this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
          manager,
          sectionId,
          IMAGE_PAGE_ENTITY_TYPE,
        );
      removedUrls.push(
        ...media.filter((item) => item.isLocalFile).map((item) => item.url),
      );
      await this.mediaItemProcessor.deleteMediaItemsByTargetInTransaction(
        manager,
        sectionId,
        IMAGE_PAGE_ENTITY_TYPE,
      );
    }

    await this.imagePageRepository.removeSectionsByIds(sectionIds, manager);
    this.logger.debug(`${sectionIds.length} seção(ões) removida(s)`);
  }

  private async updateSection(
    input: UpdateSectionDto,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<void> {
    const section = await this.imagePageRepository.findSectionById(
      input.id as string,
      manager,
    );
    if (!section) {
      throw new AppValidationException(
        ErrorCode.INVALID_INPUT,
        'Seção não pertence a esta galeria.',
      );
    }

    section.caption = input.caption;
    section.description = input.description;
    section.public = input.public;
    await this.imagePageRepository.saveSection(section, manager);

    await this.syncSectionMedia(
      section.id,
      input.mediaItems,
      filesDict,
      uploads,
      manager,
      removedUrls,
    );
  }

  private async createSection(
    page: ImagePageEntity,
    input: UpdateSectionDto,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
  ): Promise<void> {
    assertOwnedUniqueIds(input.mediaItems, [], 'imagem');
    const section = await this.imagePageRepository.createSection(
      page,
      {
        caption: input.caption,
        description: input.description,
        public: input.public,
      },
      manager,
    );

    await this.mediaItemProcessor.processMediaItemsPolymorphic(
      input.mediaItems.map((item) => ({ ...item, fileField: item.fieldKey })),
      section.id,
      IMAGE_PAGE_ENTITY_TYPE,
      filesDict,
      uploads.upload,
      manager,
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
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<void> {
    const existing =
      await this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
        manager,
        sectionId,
        IMAGE_PAGE_ENTITY_TYPE,
      );
    assertOwnedUniqueIds(incoming, existing, 'imagem');

    const incomingIds = new Set(
      incoming.map((item) => item.id).filter((id): id is string => Boolean(id)),
    );
    for (const item of existing.filter((media) => !incomingIds.has(media.id))) {
      await this.mediaItemProcessor.deleteMediaItemByIdInTransaction(
        manager,
        item.id,
      );
      if (item.isLocalFile) removedUrls.push(item.url);
    }

    const toCreate = incoming.filter((item) => !item.id);
    if (toCreate.length > 0) {
      await this.mediaItemProcessor.processMediaItemsPolymorphic(
        toCreate.map((item) => ({ ...item, fileField: item.fieldKey })),
        sectionId,
        IMAGE_PAGE_ENTITY_TYPE,
        filesDict,
        uploads.upload,
        manager,
      );
    }

    const existingById = new Map(existing.map((item) => [item.id, item]));
    for (const item of incoming.filter((media) => Boolean(media.id))) {
      await this.updateMediaItem(
        item,
        existingById.get(item.id as string),
        sectionId,
        filesDict,
        uploads,
        manager,
        removedUrls,
      );
    }
  }

  private async updateMediaItem(
    item: MediaItemDto,
    previous: MediaItemEntity | undefined,
    sectionId: string,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<MediaItemEntity> {
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
    } else if (isUpload) {
      if (!previous?.isLocalFile || !previous.url) {
        throw new AppValidationException(
          ErrorCode.MEDIA_FILE_NOT_FOUND,
          `Arquivo ausente para a mídia "${item.title ?? ''}"`,
        );
      }
      // O arquivo já guardado não pode ser redirecionado pelo cliente: URL,
      // nome e tamanho vêm do registro, não do payload.
      media.url = previous.url;
      media.isLocalFile = true;
      media.originalName = previous.originalName;
      media.size = previous.size;
      media.platformType = undefined;
    } else {
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
