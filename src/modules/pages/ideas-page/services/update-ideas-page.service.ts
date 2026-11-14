import { DeleteIdeaAiAssetsService } from '../../ideas-section-ai/services/delete-idea-ai-assets.service';
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
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import {
  UpdateIdeasPageDto,
  UpdateIdeasSectionDto,
} from '../dto/update-ideas-page.dto';
import { IdeasPageResponseDto } from '../dto/ideas-page-response.dto';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import { IdeasPageGetService } from './get-ideas-page.service';
import {
  assertUploadsHaveFiles,
  assertOwnedUniqueIds,
  assertMediaLinks,
  planSectionSync,
  toMediaItemInputs,
} from '../utils';
import { MulterFilesDict } from '../types';
import {
  IDEAS_PAGE_ENTITY_TYPE,
  IDEAS_PAGE_ROUTE_IMAGE_URL,
  IDEAS_PAGE_ROUTE_PATH_PREFIX,
  IDEAS_PAGE_ROUTE_PUBLIC,
  IDEAS_SECTION_MEDIA_TARGET_TYPE,
} from '../constants';

@Injectable()
export class IdeasPageUpdateService {
  private readonly logger = new Logger(IdeasPageUpdateService.name);

  constructor(
    private readonly aiAssets: DeleteIdeaAiAssetsService,
    private readonly ideasPageRepository: IdeasPageRepository,
    private readonly getService: IdeasPageGetService,
    private readonly getRouteService: GetRouteService,
    private readonly updateRouteService: UpdateRouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async updateIdeasPage(
    id: string,
    dto: UpdateIdeasPageDto,
    filesDict: MulterFilesDict,
  ): Promise<IdeasPageResponseDto> {
    // Storage is compensated on rollback; old files are deleted only after commit.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    const removedUrls: string[] = [];

    try {
      const page = await this.getService.findEntityOrFail(id);
      const route = await this.loadRoute(page.id);

      // Só as mídias novas exigem arquivo: as já gravadas voltam do cliente
      // sem `fieldKey`, apenas com o id e a URL que já estão no banco.
      assertUploadsHaveFiles(
        dto.sections.flatMap((section) =>
          section.medias.filter(
            (media) => !media.id || media.fieldKey || media.fileField,
          ),
        ),
        filesDict,
      );

      assertOwnedUniqueIds(dto.sections, page.sections ?? [], 'seção');
      assertMediaLinks(dto.sections.flatMap((section) => section.medias));

      await this.ideasPageRepository.runInTransaction(
        async (manager: EntityManager) => {
          await this.syncSections(
            page,
            dto.sections,
            filesDict,
            uploads,
            manager,
            removedUrls,
          );
          await this.upsertRoute(route, dto, page.id, manager);

          // Só as colunas da página são gravadas. `save()` arrastaria em cascata
          // as seções carregadas junto dela e reverteria a sincronização.
          await this.ideasPageRepository.updateContent(
            page.id,
            {
              title: dto.title,
              subtitle: dto.subtitle ?? page.subtitle ?? '',
              description: dto.description,
              public: dto.public ?? page.public,
            },
            manager,
          );
        },
      );

      await this.mediaItemProcessor.discardUnreferencedUploads(
        removedUrls,
        (url) => this.awsS3Service.delete(url),
      );

      this.logger.log(`Página de ideias atualizada. ID=${page.id}`);

      return await this.getService.buildResponse(page.id);
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      this.logger.error(
        `Erro ao atualizar página de ideias. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_UPDATE_ERROR,
        'Erro ao atualizar a página de ideias',
        error as Error,
      );
    }
  }

  private async loadRoute(pageId: string): Promise<RouteEntity> {
    const route = await this.getRouteService.findRouteByEntityId(pageId);
    if (!route) {
      throw new AppNotFoundException(
        ErrorCode.ROUTE_NOT_FOUND,
        'Rota da página de ideias não encontrada',
      );
    }
    return route;
  }

  /**
   * O path é recalculado a partir do título e mantém a unicidade ignorando a
   * própria rota — gravar o prefixo fixo colidiria com as demais páginas.
   */
  private async upsertRoute(
    route: RouteEntity,
    dto: UpdateIdeasPageDto,
    pageId: string,
    manager: EntityManager,
  ): Promise<RouteEntity> {
    return this.updateRouteService.upsertRouteWithAvailablePath(
      route.id,
      {
        title: dto.title,
        subtitle: dto.subtitle ?? route.subtitle,
        description: dto.description,
        idToFetch: pageId,
        entityId: pageId,
        entityType: IDEAS_PAGE_ENTITY_TYPE,
        type: RouteType.PAGE,
        public: IDEAS_PAGE_ROUTE_PUBLIC,
        current: route.current,
        image: IDEAS_PAGE_ROUTE_IMAGE_URL,
      },
      IDEAS_PAGE_ROUTE_PATH_PREFIX,
      manager,
    );
  }

  /**
   * Aplica as seções recebidas: remove as que sumiram do payload, atualiza as
   * que mantiveram o id e cria o restante.
   */
  private async syncSections(
    page: IdeasPageEntity,
    incoming: UpdateIdeasSectionDto[],
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<void> {
    const existing = page.sections ?? [];
    const plan = planSectionSync(existing, incoming);
    const existingById = new Map(
      existing.map((section) => [section.id, section]),
    );

    await this.removeSections(plan.toRemove, manager, removedUrls);

    for (const input of plan.toUpdate) {
      const current = input.id ? existingById.get(input.id) : undefined;

      if (!current)
        throw new AppValidationException(
          ErrorCode.INVALID_INPUT,
          'Seção não pertence a esta página.',
        );
      await this.updateSection(
        current,
        input,
        filesDict,
        uploads,
        manager,
        removedUrls,
      );
    }

    for (const input of plan.toCreate) {
      await this.createSection(page, input, filesDict, uploads, manager);
    }
  }

  /** Remove as seções e tudo que pendurava nelas: mídias e arquivos no S3. */
  private async removeSections(
    sectionIds: string[],
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<void> {
    for (const id of sectionIds) {
      removedUrls.push(...(await this.aiAssets.remove(id, manager)));
      const media =
        await this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
          manager,
          id,
          IDEAS_SECTION_MEDIA_TARGET_TYPE,
        );
      removedUrls.push(
        ...media.filter((item) => item.isLocalFile).map((item) => item.url),
      );
      await this.mediaItemProcessor.deleteMediaItemsByTargetInTransaction(
        manager,
        id,
        IDEAS_SECTION_MEDIA_TARGET_TYPE,
      );
    }
    if (sectionIds.length)
      await this.ideasPageRepository.removeSectionsByIds(sectionIds, manager);
  }

  private async updateSection(
    section: IdeasSectionEntity,
    input: UpdateIdeasSectionDto,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
    removedUrls: string[],
  ): Promise<void> {
    section.title = input.title;
    section.description = input.description;
    // Sem o campo no payload, a visibilidade atual é preservada: publicar uma
    // seção é decisão do editor de seções, não efeito de salvar a página.
    section.public = input.public ?? section.public;
    await this.ideasPageRepository.saveSection(section, manager);

    await this.syncSectionMedia(
      section.id,
      input.medias,
      filesDict,
      uploads,
      manager,
      removedUrls,
    );
  }

  private async createSection(
    page: IdeasPageEntity,
    input: UpdateIdeasSectionDto,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
    manager: EntityManager,
  ): Promise<void> {
    assertOwnedUniqueIds(input.medias, [], 'mídia');
    const section = await this.ideasPageRepository.createSection(
      page,
      {
        title: input.title,
        description: input.description,
        public: input.public ?? false,
      },
      manager,
    );

    await this.mediaItemProcessor.processMediaItemsPolymorphic(
      toMediaItemInputs(input.medias),
      section.id,
      IDEAS_SECTION_MEDIA_TARGET_TYPE,
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
        IDEAS_SECTION_MEDIA_TARGET_TYPE,
      );
    assertOwnedUniqueIds(incoming, existing, 'mídia');
    const existingById = new Map(existing.map((item) => [item.id, item]));

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

    for (const item of incoming) {
      const previous = item.id ? existingById.get(item.id) : undefined;
      await this.upsertMediaItem(
        item,
        previous,
        sectionId,
        filesDict,
        uploads,
        manager,
        removedUrls,
      );
    }
  }

  private async upsertMediaItem(
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
      IDEAS_SECTION_MEDIA_TARGET_TYPE,
    );

    const isUpload = item.uploadType === UploadType.UPLOAD;
    const fieldKey = item.fieldKey ?? item.fileField;
    const file = fieldKey ? filesDict[fieldKey] : undefined;

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
          'Selecione o arquivo da mídia antes de salvar.',
        );
      }
      // Storage metadata is authoritative; a text-only edit cannot redirect a stored file.
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
    }

    if (previous) media.id = previous.id;
    const saved = await this.mediaItemProcessor.saveMediaItemInTransaction(
      manager,
      media,
    );
    if (previous?.isLocalFile && previous.url && previous.url !== saved.url) {
      removedUrls.push(previous.url);
    }

    return saved;
  }
}
