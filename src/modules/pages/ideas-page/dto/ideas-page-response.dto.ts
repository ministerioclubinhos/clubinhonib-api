import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';

export class IdeasRouteDto {
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

export class IdeasMediaItemResponseDto {
  id: string;
  title: string;
  description: string;
  mediaType: MediaType;
  uploadType: UploadType;
  platformType?: PlatformType;
  url: string;
  isLocalFile: boolean;
  originalName?: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class IdeasSectionResponseDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  medias: IdeasMediaItemResponseDto[];
}

export class IdeasPageResponseDto {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  route: IdeasRouteDto;
  sections: IdeasSectionResponseDto[];
}
