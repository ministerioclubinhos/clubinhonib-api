import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';

import { PlayScope } from 'src/modules/play/enums/play-scope.enum';

/** Contrato público de um vídeo da galeria. */
export class VideoItemResponseDto {
  id: string;
  title: string;
  description: string;
  uploadType: UploadType;
  mediaType: MediaType;
  platformType?: PlatformType;
  url: string;
  isLocalFile: boolean;
  originalName?: string;
  size?: number;
  /** Atributos do Play; só quando a galeria tem o Play configurado. */
  inPlay?: boolean;
  featured?: boolean;
  position?: number | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
}

/** Contrato público da rota que expõe a galeria. */
export class VideoRouteDto {
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

/** Contrato público da galeria de vídeos. */
export class VideosPageResponseDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  route: VideoRouteDto;
  play: { scope: PlayScope; categoryId: string | null };
  videos: VideoItemResponseDto[];
}
