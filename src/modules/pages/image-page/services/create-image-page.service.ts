import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { CreateImagePageDto } from '../dto/create-image.dto';
import { ImagePageResponseDto } from '../dto/image-page-response.dto';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { toImagePageResponse } from '../mappers';
import { MediaBySection, MulterFilesDict } from '../types';
import {
  IMAGE_PAGE_ENTITY_TYPE,
  IMAGE_PAGE_ROUTE_IMAGE_URL,
  IMAGE_PAGE_ROUTE_PATH_PREFIX,
  IMAGE_PAGE_ROUTE_SUBTITLE,
} from '../constants';

@Injectable()
export class ImagePageCreateService {
  private readonly logger = new Logger(ImagePageCreateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly imagePageRepository: ImagePageRepository,
    private readonly routeService: RouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async createImagePage(
    dto: CreateImagePageDto,
    filesDict: MulterFilesDict,
  ): Promise<ImagePageResponseDto> {
    this.assertUploadedFiles(dto, filesDict);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedPage: ImagePageEntity | null = null;

    // Cada arquivo enviado fica registrado: se a criação falhar depois do
    // upload, o objeto é apagado do bucket em vez de ficar órfão.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      const manager = queryRunner.manager;

      savedPage = await this.imagePageRepository.createPage(
        {
          name: dto.title,
          description: dto.description,
          public: dto.public,
        },
        manager,
      );

      savedPage.route = await this.createRoute(dto, savedPage, manager);
      savedPage = await this.imagePageRepository.savePage(savedPage, manager);

      const mediaBySection = await this.createSections(
        dto,
        savedPage,
        filesDict,
        manager,
        uploads,
      );

      const page = await this.imagePageRepository.findByIdWithSections(
        savedPage.id,
        manager,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Galeria criada. ID=${savedPage.id}`);

      return toImagePageResponse(page ?? savedPage, mediaBySection);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      await this.discardOrphanMedia(savedPage?.id);
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      this.logger.error(
        'Erro ao criar galeria. Rollback executado.',
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro ao criar a galeria. Nenhum dado foi salvo.',
        error as Error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /** Toda mídia enviada como upload precisa do arquivo correspondente. */
  private assertUploadedFiles(
    dto: CreateImagePageDto,
    filesDict: MulterFilesDict,
  ): void {
    const uploads = dto.sections
      .flatMap((section) => section.mediaItems)
      .filter(
        (item: MediaItemDto) =>
          item.uploadType === UploadType.UPLOAD && item.isLocalFile,
      );

    for (const item of uploads) {
      if (!item.fieldKey) {
        throw new AppValidationException(
          ErrorCode.MEDIA_FIELD_MISSING,
          `fieldKey ausente para a mídia "${item.title ?? ''}"`,
        );
      }

      if (!filesDict[item.fieldKey]) {
        throw new AppValidationException(
          ErrorCode.MEDIA_FILE_NOT_FOUND,
          `Arquivo ausente para a mídia "${item.title ?? ''}"`,
        );
      }
    }
  }

  private async createRoute(
    dto: CreateImagePageDto,
    page: ImagePageEntity,
    manager: EntityManager,
  ) {
    const path = await this.routeService.generateAvailablePath(
      dto.title,
      IMAGE_PAGE_ROUTE_PATH_PREFIX,
    );

    return this.routeService.createRouteWithManager(manager, {
      title: dto.title,
      subtitle: IMAGE_PAGE_ROUTE_SUBTITLE,
      description: dto.description,
      path,
      idToFetch: page.id,
      entityId: page.id,
      entityType: IMAGE_PAGE_ENTITY_TYPE,
      type: RouteType.PAGE,
      image: IMAGE_PAGE_ROUTE_IMAGE_URL,
      public: dto.public,
    });
  }

  private async createSections(
    dto: CreateImagePageDto,
    page: ImagePageEntity,
    filesDict: MulterFilesDict,
    manager: EntityManager,
    uploads: S3UploadTracker,
  ): Promise<MediaBySection> {
    const mediaBySection: MediaBySection = new Map();

    for (const sectionInput of dto.sections) {
      const section = await this.imagePageRepository.createSection(
        page,
        {
          caption: sectionInput.caption,
          description: sectionInput.description,
          public: sectionInput.public,
        },
        manager,
      );

      const mediaItems =
        await this.mediaItemProcessor.processMediaItemsPolymorphic(
          sectionInput.mediaItems.map((item) => ({
            ...item,
            fileField: item.fieldKey,
          })),
          section.id,
          IMAGE_PAGE_ENTITY_TYPE,
          filesDict,
          uploads.upload,
        );

      mediaBySection.set(section.id, mediaItems);
    }

    return mediaBySection;
  }

  /**
   * As mídias são gravadas fora da transação da galeria: no rollback, apagar o
   * que já foi persistido evita registro e arquivo órfãos.
   */
  private async discardOrphanMedia(pageId?: string): Promise<void> {
    if (!pageId) return;

    try {
      const sections =
        await this.imagePageRepository.findSectionsOfPage(pageId);
      const sectionIds = sections.map((section) => section.id);
      if (sectionIds.length === 0) return;

      const orphans = await this.mediaItemProcessor.findManyMediaItemsByTargets(
        sectionIds,
        IMAGE_PAGE_ENTITY_TYPE,
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
        `Falha ao remover mídias órfãs da galeria ${pageId}`,
        cleanupError instanceof Error ? cleanupError.stack : undefined,
      );
    }
  }
}
