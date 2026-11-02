import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { CreateRouteService } from 'src/modules/routes/services/create-route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { AnnounceWeekMaterialService } from './announce-week-material.service';
import { WeekMaterialsPageRepository } from '../repositories/week-material-page.repository';
import { CreateWeekMaterialsPageDto } from '../dto/create-week-material.dto';
import { WeekMaterialsPageResponseDTO } from '../dto/week-material-response.dto';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { toWeekMaterialsPageResponse } from '../mappers';
import { MulterFilesDict } from '../types';
import {
  assertUploadFieldKeys,
  assertUploadFilesPresent,
  normalizeIncomingMedia,
} from '../utils';
import {
  WEEK_MATERIAL_ENTITY_TYPE,
  WEEK_MATERIAL_ROUTE_IMAGE_URL,
  WEEK_MATERIAL_ROUTE_PATH_PREFIX,
} from '../constants';

@Injectable()
export class WeekMaterialsPageCreateService {
  private readonly logger = new Logger(WeekMaterialsPageCreateService.name);

  constructor(
    private readonly pageRepo: WeekMaterialsPageRepository,
    private readonly s3: AwsS3Service,
    private readonly createRouteService: CreateRouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly announceService: AnnounceWeekMaterialService,
  ) {}

  async createWeekMaterialsPage(
    dto: CreateWeekMaterialsPageDto,
    filesDict: MulterFilesDict,
  ): Promise<WeekMaterialsPageResponseDTO> {
    const incomingMedia = normalizeIncomingMedia(dto);
    assertUploadFieldKeys(incomingMedia);
    // Arquivo declarado e não enviado é erro de entrada (422). Sem esta
    // checagem o processador de mídia estourava dentro da transação e a
    // requisição respondia erro interno.
    assertUploadFilesPresent(incomingMedia, filesDict);

    // Fica fora do bloco porque o `catch` precisa do id para varrer a mídia
    // que tenha sobrado da tentativa.
    let savedPage: WeekMaterialsPageEntity | undefined;

    // Cada arquivo enviado fica registrado: se a criação falhar depois do
    // upload, o objeto é apagado do bucket em vez de ficar órfão.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.s3.upload(file),
    );

    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      const { page, mediaItems } = await this.pageRepo.runInTransaction(
        async (manager) => {
          const created = await this.persistPageWithRoute(dto, manager);
          savedPage = created;

          const media =
            await this.mediaItemProcessor.processMediaItemsPolymorphic(
              incomingMedia,
              created.id,
              WEEK_MATERIAL_ENTITY_TYPE,
              filesDict,
              uploads.upload,
            );

          return { page: created, mediaItems: media };
        },
      );

      this.logger.log(`Página de materiais criada. ID=${page.id}`);

      // O aviso sai depois do commit e fora da requisição: são muitos
      // destinatários, e uma falha no e-mail não pode desfazer a página.
      this.announceService.announceInBackground(page);

      return toWeekMaterialsPageResponse(page, mediaItems);
    } catch (error: unknown) {
      await this.discardOrphanMedia(savedPage?.id);
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3.delete(url),
      );

      this.logger.error(
        'Erro ao criar página de materiais. Rollback executado.',
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_CREATE_ERROR,
        'Erro ao criar a página de materiais.',
        error as Error,
      );
    }
  }

  private async persistPageWithRoute(
    dto: CreateWeekMaterialsPageDto,
    manager: EntityManager,
  ): Promise<WeekMaterialsPageEntity> {
    const page = await this.pageRepo.createPage(
      {
        title: dto.pageTitle,
        subtitle: dto.pageSubtitle,
        description: dto.pageDescription,
        sourceLessonId: dto.sourceLessonId ?? null,
        // Publishing is exclusive to POST /current-week/:id, which also clears
        // the previously published page; creating never sets the flag.
        currentWeek: false,
      },
      manager,
    );

    const path = await this.createRouteService.generateAvailablePath(
      dto.pageTitle,
      WEEK_MATERIAL_ROUTE_PATH_PREFIX,
    );

    page.route = await this.createRouteService.createRouteWithManager(manager, {
      title: dto.pageTitle,
      subtitle: dto.pageSubtitle,
      description: dto.pageDescription,
      path,
      type: RouteType.PAGE,
      entityId: page.id,
      idToFetch: page.id,
      entityType: WEEK_MATERIAL_ENTITY_TYPE,
      image: WEEK_MATERIAL_ROUTE_IMAGE_URL,
      public: true,
      current: false,
    });

    return this.pageRepo.savePage(page, manager);
  }

  /**
   * Media rows and S3 objects are written outside the page transaction, so a
   * rollback must delete whatever was already persisted for the page.
   */
  private async discardOrphanMedia(pageId?: string): Promise<void> {
    if (!pageId) return;

    try {
      const orphans = await this.mediaItemProcessor.findMediaItemsByTarget(
        pageId,
        WEEK_MATERIAL_ENTITY_TYPE,
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
