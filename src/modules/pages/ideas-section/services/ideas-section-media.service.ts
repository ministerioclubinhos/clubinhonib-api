import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

import { IdeasSectionMediaType } from '../entities/ideas-section-media-type.enum';
import { IdeasSectionMediaItemDto } from '../dto/ideas-section-media-item.dto';
import { UploadedFilesDict } from '../types';

/**
 * Gravação das mídias de uma ideia compartilhada.
 *
 * Edição e publicação fazem o mesmo trabalho com as mídias, então ele mora
 * aqui: as duas cópias que existiam já haviam começado a divergir.
 */
@Injectable()
export class IdeasSectionMediaService {
  private readonly logger = new Logger(IdeasSectionMediaService.name);

  constructor(
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  /** Mídias já gravadas para a seção, lidas dentro da transação em curso. */
  async findExisting(
    sectionId: string,
    manager: EntityManager,
  ): Promise<MediaItemEntity[]> {
    return this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
      manager,
      sectionId,
      MediaTargetType.IdeasSection,
    );
  }

  async deleteMedia(
    existingMedia: MediaItemEntity[],
    requestedMedias: IdeasSectionMediaItemDto[],
    manager: EntityManager,
  ): Promise<void> {
    const requestedMediaIds = requestedMedias
      .map((media) => media.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const mediaToRemove = existingMedia.filter(
      (existing) => existing.id && !requestedMediaIds.includes(existing.id),
    );

    for (const media of mediaToRemove) {
      if (!media.id) {
        continue;
      }

      if (media.isLocalFile && media.url) {
        // A falha na remoção é registrada, não interrompe: abortar a edição
        // por causa do S3 deixaria a seção pela metade.
        await this.awsS3Service.delete(media.url);
      }

      await this.mediaItemProcessor.deleteMediaItemByIdInTransaction(
        manager,
        media.id,
      );
    }
  }

  async processSectionMedia(
    mediaItems: IdeasSectionMediaItemDto[],
    sectionId: string,
    oldMedia: MediaItemEntity[],
    filesDict: UploadedFilesDict,
    manager: EntityManager,
    uploads: S3UploadTracker,
  ): Promise<MediaItemEntity[]> {
    const oldById = new Map(oldMedia.map((item) => [item.id, item]));

    const processedMedia: MediaItemEntity[] = [];

    for (const mediaInput of mediaItems) {
      if (mediaInput.id) {
        const savedMedia = await this.upsertMedia(
          mediaInput,
          sectionId,
          filesDict,
          manager,
          uploads,
          oldById.get(mediaInput.id),
        );
        processedMedia.push(savedMedia);
      } else {
        const savedMedia = await this.addMedia(
          mediaInput,
          sectionId,
          filesDict,
          uploads,
        );
        processedMedia.push(savedMedia);
      }
    }
    return processedMedia;
  }

  private async addMedia(
    mediaInput: IdeasSectionMediaItemDto,
    targetId: string,
    filesDict: UploadedFilesDict,
    uploads: S3UploadTracker,
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType:
          (mediaInput.mediaType as unknown as MediaType) ||
          IdeasSectionMediaType.IMAGE,
      },
      targetId,
      MediaTargetType.IdeasSection,
    );

    if (
      mediaInput.uploadType === UploadType.UPLOAD ||
      mediaInput.isLocalFile === true
    ) {
      media.platformType = undefined;
      if (!mediaInput.fieldKey) {
        this.logger.error(`FieldKey ausente para mídia "${mediaInput.title}"`);
        throw new AppValidationException(
          ErrorCode.MEDIA_FIELD_MISSING,
          `FieldKey ausente para mídia "${mediaInput.title}"`,
        );
      }
      const file = filesDict[mediaInput.fieldKey];
      if (!file) {
        this.logger.error(
          `Arquivo ausente para mídia "${mediaInput.title}" (fieldKey: ${mediaInput.fieldKey})`,
        );
        throw new AppValidationException(
          ErrorCode.MEDIA_FILE_NOT_FOUND,
          `Arquivo ausente para mídia "${mediaInput.title}"`,
        );
      }
      media.url = await uploads.upload(file);
      media.isLocalFile = mediaInput.isLocalFile;
      media.originalName = file.originalname;
      media.size = file.size;
    } else {
      media.title = mediaInput.title || media.title;
      media.description = mediaInput.description || media.description;
      media.uploadType = mediaInput.uploadType || media.uploadType;
      media.platformType = mediaInput.platformType || media.platformType;
      media.mediaType =
        (mediaInput.mediaType as unknown as MediaType) || media.mediaType;
      media.url = mediaInput.url?.trim() || media.url;
      media.originalName = mediaInput.originalName || media.originalName;
      media.isLocalFile = mediaInput.isLocalFile || media.isLocalFile;
      media.size = mediaInput.size || media.size;
    }

    const savedMedia = await this.mediaItemProcessor.saveMediaItem(media);
    return savedMedia;
  }

  private async upsertMedia(
    mediaInput: IdeasSectionMediaItemDto,
    targetId: string,
    filesDict: UploadedFilesDict,
    manager: EntityManager,
    uploads: S3UploadTracker,
    previous?: MediaItemEntity,
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType: mediaInput.mediaType as unknown as MediaType,
      },
      targetId,
      MediaTargetType.IdeasSection,
    );

    const isUpload =
      mediaInput.uploadType === UploadType.UPLOAD ||
      mediaInput.isLocalFile === true;
    const fileKey = mediaInput.fieldKey ?? mediaInput.url;
    const file = fileKey ? filesDict[fileKey] : undefined;

    if (isUpload && file) {
      // Troca de arquivo em uma mídia já gravada: o novo sobe primeiro e o
      // antigo só sai depois que o registro passa a apontar para ele.
      media.url = await uploads.upload(file);
      media.originalName = file.originalname;
      media.isLocalFile = true;
      media.size = file.size;
      media.platformType = undefined;
    } else if (isUpload && !previous?.url) {
      // Upload sem arquivo e sem nada guardado para reaproveitar.
      this.logger.error(
        `Arquivo ausente para a mídia "${mediaInput.title ?? ''}"`,
      );
      throw new AppValidationException(
        ErrorCode.MEDIA_FILE_NOT_FOUND,
        `Arquivo ausente para a mídia "${mediaInput.title ?? ''}"`,
      );
    } else {
      // Sem arquivo novo, o objeto que já está no S3 é preservado.
      media.title = mediaInput.title || media.title;
      media.description = mediaInput.description || media.description;
      media.uploadType = mediaInput.uploadType || media.uploadType;
      media.platformType = mediaInput.platformType || media.platformType;
      media.mediaType =
        (mediaInput.mediaType as unknown as MediaType) || media.mediaType;
      media.url = mediaInput.url?.trim() || previous?.url || media.url;
      media.originalName =
        mediaInput.originalName || previous?.originalName || media.originalName;
      media.isLocalFile =
        mediaInput.isLocalFile ?? previous?.isLocalFile ?? media.isLocalFile;
      media.size = mediaInput.size || previous?.size || media.size;
    }

    const savedMedia = await this.mediaItemProcessor.saveMediaItemInTransaction(
      manager,
      { ...media, id: mediaInput.id },
    );

    if (
      previous?.isLocalFile &&
      previous.url &&
      previous.url !== savedMedia.url
    ) {
      await this.awsS3Service.delete(previous.url);
    }

    return savedMedia;
  }
}
