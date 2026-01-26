import {
  AppNotFoundException,
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  UploadType,
  MediaItemEntity,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { ImageSectionRepository } from '../repository/image-section.repository';
import { ImagePageRepository } from 'src/modules/pages/image-page/repository/image-page.repository';
import { UpdateImageSectionDto } from '../dto/update-image-section.dto';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { ImageSectionResponseDto } from '../dto/image-section-response.dto';

@Injectable()
export class ImageSectionUpdateService {
  private readonly logger = new Logger(ImageSectionUpdateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly sectionRepo: ImageSectionRepository,
    private readonly pageRepo: ImagePageRepository,
  ) {}

  async updateSection(
    id: string,
    dto: UpdateImageSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<ImageSectionResponseDto> {
    this.logger.log(`🚀 Iniciando atualização da seção com ID: ${id}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const section = await this.sectionRepo.findOneBy({ id });
      if (!section) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Seção não encontrada',
        );
      }

      const pageIdFromEnv = this.configService.get<string>(
        'FEED_CLUBINHO_PAGE_ID',
      );
      const page = await this.pageRepo.findOneBy({ id: pageIdFromEnv });
      if (!page) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Página padrão não encontrada',
        );
      }

      const existingMedia =
        await this.mediaItemProcessor.findManyMediaItemsByTargets(
          [section.id],
          MediaTargetType.ImagesPage,
        );

      await this.deleteObsoleteMedia(
        existingMedia,
        dto.mediaItems,
        queryRunner,
      );
      const processedMedia = await this.processMedia(
        dto.mediaItems,
        section.id,
        filesDict,
        queryRunner,
      );
      section.caption = dto.caption;
      section.description = dto.description;
      section.public = dto.public || false;
      section.page = page;
      const savedSection = await queryRunner.manager.save(section);

      await queryRunner.commitTransaction();
      return ImageSectionResponseDto.fromEntity(savedSection, processedMedia);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Erro ao atualizar a seção', error.stack);
      if (error.code) throw error;
      throw new AppInternalException(
        ErrorCode.SECTION_UPDATE_ERROR,
        'Erro ao atualizar a seção',
        error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async deleteObsoleteMedia(
    existingMedia: MediaItemEntity[],
    incomingMedia: MediaItemDto[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    const incomingIds = incomingMedia
      .map((m) => m.id)
      .filter((id): id is string => !!id);
    const toRemove = existingMedia.filter((m) => !incomingIds.includes(m.id));

    if (toRemove.length > 0) {
      await this.mediaItemProcessor.deleteMediaItems(toRemove, async (url) => {
        await this.awsS3Service.delete(url);
      });
    }
  }

  private async processMedia(
    mediaItems: MediaItemDto[],
    sectionId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity[]> {
    const processed: MediaItemEntity[] = [];

    for (const mediaInput of mediaItems) {
      if (mediaInput.id) {
        const updated = await this.upsertMedia(
          mediaInput,
          sectionId,
          filesDict,
          queryRunner,
        );
        processed.push(updated);
      } else {
        const created = await this.addMedia(
          mediaInput,
          sectionId,
          filesDict,
          queryRunner,
        );
        processed.push(created);
      }
    }
    return processed;
  }

  private async addMedia(
    mediaInput: MediaItemDto,
    sectionId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      mediaInput,
      sectionId,
      MediaTargetType.ImagesPage,
    );

    if (mediaInput.uploadType === UploadType.UPLOAD && mediaInput.isLocalFile) {
      const file = filesDict[mediaInput.fieldKey ?? ''];
      if (!file) {
        throw new AppValidationException(
          ErrorCode.MEDIA_FILE_NOT_FOUND,
          'Arquivo não encontrado para upload',
        );
      }
      media.url = await this.awsS3Service.upload(file);
      media.isLocalFile = true;
      media.originalName = file.originalname;
      media.size = file.size;
    } else {
      media.url = mediaInput.url?.trim() || '';
      media.isLocalFile = false;
    }

    return await this.mediaItemProcessor.saveMediaItem(media);
  }

  private async upsertMedia(
    mediaInput: MediaItemDto,
    sectionId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    const existingMedia = await queryRunner.manager.findOneBy(MediaItemEntity, {
      id: mediaInput.id,
    });
    if (!existingMedia) {
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Mídia com id=${mediaInput.id} não encontrada`,
      );
    }

    const updatedMedia = this.mediaItemProcessor.buildBaseMediaItem(
      mediaInput,
      sectionId,
      MediaTargetType.ImagesPage,
    );
    updatedMedia.id = existingMedia.id;

    if (mediaInput.uploadType === UploadType.UPLOAD && mediaInput.isLocalFile) {
      const file = filesDict[mediaInput.fieldKey ?? ''];
      if (file) {
        updatedMedia.url = await this.awsS3Service.upload(file);
        updatedMedia.isLocalFile = true;
        updatedMedia.originalName = file.originalname;
        updatedMedia.size = file.size;
      } else {
        updatedMedia.url = existingMedia.url;
        updatedMedia.isLocalFile = existingMedia.isLocalFile;
        updatedMedia.originalName = existingMedia.originalName;
        updatedMedia.size = existingMedia.size;
      }
    } else {
      updatedMedia.url = mediaInput.url?.trim() || existingMedia.url;
      updatedMedia.isLocalFile = false;
    }

    return await this.mediaItemProcessor.upsertMediaItem(
      mediaInput.id,
      updatedMedia,
    );
  }
}
