import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteEntity, RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { CreateIdeasPageDto } from '../dto/create-ideas-page.dto';
import { IdeasPageResponseDto } from '../dto/ideas-page-response.dto';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { toIdeasPageResponse } from '../mappers';
import { assertUploadsHaveFiles, toMediaItemInputs } from '../utils';
import { MediaBySection, MulterFilesDict } from '../types';
import {
  IDEAS_PAGE_ENTITY_TYPE,
  IDEAS_PAGE_ROUTE_IMAGE_URL,
  IDEAS_PAGE_ROUTE_PATH_PREFIX,
  IDEAS_PAGE_ROUTE_PUBLIC,
  IDEAS_SECTION_MEDIA_TARGET_TYPE,
} from '../constants';

@Injectable()
export class IdeasPageCreateService {
  private readonly logger = new Logger(IdeasPageCreateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ideasPageRepository: IdeasPageRepository,
    private readonly routeService: RouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async createIdeasPage(
    dto: CreateIdeasPageDto,
    filesDict: MulterFilesDict,
  ): Promise<IdeasPageResponseDto> {
    // Falhar antes de gravar qualquer coisa: um arquivo faltando no meio do
    // processo deixaria página e mídias pela metade.
    assertUploadsHaveFiles(
      dto.sections.flatMap((section) => section.medias),
      filesDict,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedPage: IdeasPageEntity | null = null;

    // Cada arquivo enviado fica registrado: se a criação falhar depois do
    // upload, o objeto é apagado do bucket em vez de ficar órfão.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      const manager = queryRunner.manager;

      savedPage = await this.ideasPageRepository.createPage(
        {
          title: dto.title,
          subtitle: dto.subtitle ?? '',
          description: dto.description,
          public: dto.public ?? false,
        },
        manager,
      );

      savedPage.route = await this.createRoute(dto, savedPage, manager);
      savedPage = await this.ideasPageRepository.savePage(savedPage, manager);

      const mediaBySection = await this.createSections(
        dto,
        savedPage,
        filesDict,
        manager,
        uploads,
      );

      const page = await this.ideasPageRepository.findByIdWithSections(
        savedPage.id,
        manager,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Página de ideias criada. ID=${savedPage.id}`);

      return toIdeasPageResponse(page ?? savedPage, mediaBySection);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      await this.discardOrphanMedia(savedPage?.id);
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      this.logger.error(
        'Erro ao criar página de ideias. Rollback executado.',
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_CREATE_ERROR,
        'Erro ao criar a página de ideias. Nenhum dado foi salvo.',
        error as Error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async createRoute(
    dto: CreateIdeasPageDto,
    page: IdeasPageEntity,
    manager: EntityManager,
  ): Promise<RouteEntity> {
    const path = await this.routeService.generateAvailablePath(
      dto.title,
      IDEAS_PAGE_ROUTE_PATH_PREFIX,
    );

    return this.routeService.createRouteWithManager(manager, {
      title: dto.title,
      subtitle: dto.subtitle ?? '',
      description: dto.description,
      path,
      idToFetch: page.id,
      entityId: page.id,
      entityType: IDEAS_PAGE_ENTITY_TYPE,
      type: RouteType.PAGE,
      image: IDEAS_PAGE_ROUTE_IMAGE_URL,
      public: IDEAS_PAGE_ROUTE_PUBLIC,
    });
  }

  /**
   * Cria as seções na ordem recebida e anexa as mídias à seção que acabou de
   * ser gravada — nunca por índice, que não acompanha a ordem do banco.
   */
  private async createSections(
    dto: CreateIdeasPageDto,
    page: IdeasPageEntity,
    filesDict: MulterFilesDict,
    manager: EntityManager,
    uploads: S3UploadTracker,
  ): Promise<MediaBySection> {
    const mediaBySection: MediaBySection = new Map();

    for (const sectionInput of dto.sections) {
      const section = await this.ideasPageRepository.createSection(
        page,
        {
          title: sectionInput.title,
          description: sectionInput.description,
          public: sectionInput.public ?? false,
        },
        manager,
      );

      const mediaItems =
        await this.mediaItemProcessor.processMediaItemsPolymorphic(
          toMediaItemInputs(sectionInput.medias),
          section.id,
          IDEAS_SECTION_MEDIA_TARGET_TYPE,
          filesDict,
          uploads.upload,
        );

      mediaBySection.set(section.id, mediaItems);
    }

    return mediaBySection;
  }

  /**
   * As mídias são gravadas fora da transação da página: no rollback, apagar o
   * que já foi persistido evita registro e arquivo órfãos.
   */
  private async discardOrphanMedia(pageId?: string): Promise<void> {
    if (!pageId) return;

    try {
      const sections =
        await this.ideasPageRepository.findSectionsOfPage(pageId);
      const sectionIds = sections.map((section) => section.id);
      if (sectionIds.length === 0) return;

      const orphans = await this.mediaItemProcessor.findManyMediaItemsByTargets(
        sectionIds,
        IDEAS_SECTION_MEDIA_TARGET_TYPE,
      );
      if (orphans.length === 0) return;

      await this.mediaItemProcessor.deleteMediaItems(orphans, (url: string) =>
        this.awsS3Service.delete(url),
      );
      this.logger.warn(
        `Compensação executada: ${orphans.length} mídia(s) órfã(s) removida(s). pageId=${pageId}`,
      );
    } catch (cleanupError: unknown) {
      this.logger.error(
        `Falha ao remover mídias órfãs da página de ideias ${pageId}`,
        cleanupError instanceof Error ? cleanupError.stack : undefined,
      );
    }
  }
}
