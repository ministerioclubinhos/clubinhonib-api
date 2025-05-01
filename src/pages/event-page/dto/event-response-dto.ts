import { MediaType, PlatformType, UploadType } from "src/share/media/media-item/media-item.entity";

export class MediaItemDto {
  id: string;
  title: string;
  description: string;
  mediaType: MediaType;
  typeUpload: UploadType;
  url: string;
  isLocalFile: boolean;
  platformType?: PlatformType;
  originalName?: string;
  size?: number;
  createdAt?: Date;
  updatedAt?: Date;

  static fromEntity(entity: any): MediaItemDto {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      mediaType: entity.mediaType,
      typeUpload: entity.uploadType, 
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

export class EventResponseDto {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  media: MediaItemDto | null;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(event: any, media: any): EventResponseDto {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      location: event.location,
      media: media ? MediaItemDto.fromEntity(media) : null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
