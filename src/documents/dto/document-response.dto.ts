import {
  MediaType,
  UploadType,
  PlatformType,
  MediaItemEntity,
} from 'src/share/media/media-item/media-item.entity';
import { DocumentEntity } from '../entities/document.entity'; 

export class MediaItemDto {
  id: string;
  title: string;
  description: string;
  mediaType: MediaType;
  uploadType: UploadType;
  url: string;
  isLocalFile: boolean;
  platformType?: PlatformType;
  originalName?: string;
  size?: number;
  createdAt?: Date;
  updatedAt?: Date;

  static fromEntity(entity: MediaItemEntity): MediaItemDto {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      mediaType: entity.mediaType,
      uploadType: entity.uploadType,
      url: entity.url,
      isLocalFile: entity.isLocalFile,
      platformType: entity.platformType ?? undefined,
      originalName: entity.originalName ?? undefined,
      size: entity.size ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class DocumentDto {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  media: MediaItemDto | null;

  static fromEntity(document: DocumentEntity | any, media?: MediaItemEntity | null): DocumentDto {
    return {
      id: document.id,
      name: document.name,
      description: document.description,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      media: media ? MediaItemDto.fromEntity(media) : null,
    };
  }
}
