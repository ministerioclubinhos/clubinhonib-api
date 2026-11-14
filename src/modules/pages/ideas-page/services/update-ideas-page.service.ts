import { DeleteIdeaAiAssetsService } from '../../ideas-section-ai/services/delete-idea-ai-assets.service';
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
    // Os uploads acontecem fora da transação da página: o rastreador permite
    // apagar do S3 o que foi enviado caso a operação falhe no meio.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      const page = await this.getService.findEntityOrFail(id);
      const route = await this.loadRoute(page.id);

      // Só as mídias novas exigem arquivo: as já gravadas voltam do cliente
      // sem `fieldKey`, apenas com o id e a URL que já estão no banco.
      assertUploadsHaveFiles(
        dto.sections.flatMap((section) =>
          section.medias.filter((media) => !media.id),
        ),
        filesDict,
      );

      await this.syncSections(page, dto.sections, filesDict, uploads);

      await this.ideasPageRepository.runInTransaction(
        async (manager: EntityManager) => {
          await this.upsertRoute(route, dto, page.id, manager);

          // Só as colunas da página são gravadas. `save()` arrastaria em cascata
          // as seções carregadas junto dela, que já estão desatualizadas depois
          // da sincronização acima, e reverteria o que acabou de ser salvo.
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
  ): Promise<void> {
    const existing = page.sections ?? [];
    const plan = planSectionSync(existing, incoming);
    const existingById = new Map(
      existing.map((section) => [section.id, section]),
    );

    await this.removeSections(plan.toRemove);

    for (const input of plan.toUpdate) {
      const current = input.id ? existingById.get(input.id) : undefined;

      // Um id que não pertence a esta página não pode ser atualizado; a seção
      // entra como nova para que o conteúdo enviado não se perca.
      if (!current) {
        this.logger.warn(
          `Seção id=${input.id} não pertence à página ${page.id}; será criada.`,
        );
        await this.createSection(page, input, filesDict, uploads);
        continue;
      }

      await this.updateSection(current, input, filesDict, uploads);
    }

    for (const input of plan.toCreate) {
      await this.createSection(page, input, filesDict, uploads);
    }
  }

  /** Remove as seções e tudo que pendurava nelas: mídias e arquivos no S3. */
  private async removeSections(sectionIds: string[]): Promise<void> {
    if (sectionIds.length === 0) return;

    const urls = await this.ideasPageRepository.runInTransaction(
      async (manager) => {
        const files: string[] = [];
        for (const id of sectionIds) {
          files.push(...(await this.aiAssets.remove(id, manager)));
          const media =
            await this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
              manager,
              id,
              IDEAS_SECTION_MEDIA_TARGET_TYPE,
            );
          files.push(...media.filter((m) => m.isLocalFile).map((m) => m.url));
          await this.mediaItemProcessor.deleteMediaItemsByTargetInTransaction(
            manager,
            id,
            IDEAS_SECTION_MEDIA_TARGET_TYPE,
          );
        }
        await this.ideasPageRepository.removeSectionsByIds(sectionIds, manager);
        return files;
      },
    );
    await this.mediaItemProcessor.discardUnreferencedUploads(urls, (url) =>
      this.awsS3Service.delete(url),
    );
  }

  private async updateSection(
    section: IdeasSectionEntity,
    input: UpdateIdeasSectionDto,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    section.title = input.title;
    section.description = input.description;
    // Sem o campo no payload, a visibilidade atual é preservada: publicar uma
    // seção é decisão do editor de seções, não efeito de salvar a página.
    section.public = input.public ?? section.public;
    await this.ideasPageRepository.saveSection(section);

    await this.syncSectionMedia(section.id, input.medias, filesDict, uploads);
  }

  private async createSection(
    page: IdeasPageEntity,
    input: UpdateIdeasSectionDto,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<void> {
    const section = await this.ideasPageRepository.createSection(page, {
      title: input.title,
      description: input.description,
      public: input.public ?? false,
    });

    await this.mediaItemProcessor.processMediaItemsPolymorphic(
      toMediaItemInputs(input.medias),
      section.id,
      IDEAS_SECTION_MEDIA_TARGET_TYPE,
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
      IDEAS_SECTION_MEDIA_TARGET_TYPE,
    );
    const existingById = new Map(existing.map((item) => [item.id, item]));

    const incomingIds = new Set(
      incoming.map((item) => item.id).filter((id): id is string => Boolean(id)),
    );
    const keptUrls = new Set(
      incoming
        .map((item) => item.url?.trim())
        .filter((url): url is string => Boolean(url)),
    );

    await this.removeMedia(
      existing.filter((item) => !incomingIds.has(item.id)),
      keptUrls,
    );

    for (const item of incoming) {
      // Um id desconhecido nesta seção não é atualizado: sobrescrever a mídia
      // apontada por ele apagaria conteúdo de outro alvo.
      const previous = item.id ? existingById.get(item.id) : undefined;
      if (item.id && !previous) {
        this.logger.warn(
          `Mídia id=${item.id} não pertence à seção ${sectionId}; será criada.`,
        );
      }

      await this.upsertMediaItem(item, previous, sectionId, filesDict, uploads);
    }
  }

  /**
   * O arquivo no S3 só é apagado quando nenhuma mídia enviada continua
   * apontando para ele, evitando derrubar o objeto de um item reaproveitado.
   */
  private async removeMedia(
    items: MediaItemEntity[],
    keptUrls: ReadonlySet<string>,
  ): Promise<void> {
    for (const item of items) {
      const keepFile = keptUrls.has(item.url);

      await this.mediaItemProcessor.removeMediaItem(
        item,
        keepFile ? undefined : (url: string) => this.awsS3Service.delete(url),
      );
    }

    if (items.length > 0) {
      this.logger.debug(`${items.length} mídia(s) removida(s)`);
    }
  }

  private async upsertMediaItem(
    item: MediaItemDto,
    previous: MediaItemEntity | undefined,
    sectionId: string,
    filesDict: MulterFilesDict,
    uploads: S3UploadTracker,
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      item,
      sectionId,
      IDEAS_SECTION_MEDIA_TARGET_TYPE,
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

    const saved = await this.mediaItemProcessor.upsertMediaItem(
      previous?.id,
      media,
    );

    // O arquivo antigo só sai depois que o registro já aponta para o novo: na
    // ordem inversa, uma falha no upload deixaria a mídia sem arquivo nenhum.
    if (previous?.isLocalFile && previous.url && previous.url !== saved.url) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        [previous.url],
        (url) => this.awsS3Service.delete(url),
      );
    }

    return saved;
  }
}
