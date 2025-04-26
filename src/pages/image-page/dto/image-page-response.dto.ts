import { RouteEntity } from 'src/route/route-page.entity';
import { MediaItemEntity, MediaType, UploadType, PlatformType } from 'src/share/media/media-item/media-item.entity';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';

export class ImageRouteDto {
  title: string;
  public: boolean;
  subtitle: string;
  image: string;
  idToFetch: string;
  path: string;
  entityType: string;
  description: string;
  entityId: string;
  type: string;

  static fromEntity(route: RouteEntity): ImageRouteDto {
    return {
      title: route.title,
      public: route.public,
      subtitle: route.subtitle,
      image: route.image,
      idToFetch: route.idToFetch,
      path: route.path,
      entityType: route.entityType,
      description: route.description,
      entityId: route.entityId,
      type: route.type,
    };
  }
}

export class GalleryMediaItemDto {
  id?: string;
  title?: string;
  description?: string;
  uploadType: UploadType;
  mediaType: MediaType;
  isLocalFile: boolean;
  url?: string;
  platformType?: PlatformType;
  originalName?: string;
  size?: number;

  static fromEntity(entity: MediaItemEntity): GalleryMediaItemDto {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      uploadType: entity.uploadType,
      mediaType: entity.mediaType,
      isLocalFile: entity.isLocalFile,
      url: entity.url,
      platformType: entity.platformType,
      originalName: entity.originalName,
      size: entity.size,
    };
  }
}

export class ImageSectionDto {
  id: string;
  caption: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  mediaItems: GalleryMediaItemDto[];

  static fromEntity(section: ImageSectionEntity, mediaItems: MediaItemEntity[]): ImageSectionDto {
    return {
      id: section.id,
      caption: section.caption,
      description: section.description,
      public: section.public,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
      mediaItems: mediaItems.map(GalleryMediaItemDto.fromEntity),
    };
  }
}

export class ImagePageResponseDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  route: ImageRouteDto;
  sections: ImageSectionDto[];

  static fromEntity(
    page: ImagePageEntity,
    mediaMap: Map<string, MediaItemEntity[]>,
  ): ImagePageResponseDto {
    if (!page.route) {
      throw new Error(`A galeria com id ${page.id} não possui rota associada.`);
    }

    return {
      id: page.id,
      title: page.name,
      description: page.description,
      public: page.public,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      route: ImageRouteDto.fromEntity(page.route),
      sections: page.sections.map((section) =>
        ImageSectionDto.fromEntity(section, mediaMap.get(section.id) || []),
      ),
    };
  }
}
