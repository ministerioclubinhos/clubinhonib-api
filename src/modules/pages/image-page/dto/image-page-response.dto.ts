import { ImageSectionAuthorDto } from '../../image-section/dto/image-section-response.dto';
import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';

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
  type: RouteType;
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
}

export class ImageSectionDto {
  authorId: string | null;
  celebrators: string[];
  celebrationCount: number;
  celebratedByMe: boolean;
  author: ImageSectionAuthorDto | null;
  id: string;
  caption: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  mediaItems: GalleryMediaItemDto[];
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
}
