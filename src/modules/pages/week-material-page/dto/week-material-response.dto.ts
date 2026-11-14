import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';

/** Public contract of a media item attached to a week material page. */
export class WeekMaterialMediaItemResponseDTO {
  id: string;
  title: string;
  description: string;
  uploadType: UploadType;
  mediaType: MediaType;
  platformType?: PlatformType;
  url: string;
  isLocalFile?: boolean;
  size?: number;
  originalName?: string;
}

/** Public contract of the route that exposes a week material page. */
export class WeekMaterialRouteResponseDTO {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  description: string;
  type: RouteType;
  public: boolean;
}

/** Public contract of a week material page and its media. */
export class WeekMaterialsPageResponseDTO {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  currentWeek: boolean;
  route: WeekMaterialRouteResponseDTO;
  videos: WeekMaterialMediaItemResponseDTO[];
  documents: WeekMaterialMediaItemResponseDTO[];
  images: WeekMaterialMediaItemResponseDTO[];
  audios: WeekMaterialMediaItemResponseDTO[];
  createdAt: Date;
  updatedAt: Date;
}
