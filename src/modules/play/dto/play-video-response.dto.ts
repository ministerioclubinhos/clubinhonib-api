import {
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { PlaySectionKind } from '../enums/play-sort.enum';

/** Onde o professor parou. */
export class PlayProgressDto {
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}

/** Contrato de um vídeo do Clubinho Play. */
export class PlayVideoResponseDto {
  id: string;
  title: string;
  description: string;
  uploadType: UploadType;
  platformType?: PlatformType;
  url: string;
  isLocalFile: boolean;
  originalName?: string;
  size?: number;
  galleryId: string;
  galleryTitle: string;
  featured: boolean;
  createdAt: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  categoryId: string | null;
  categoryName: string | null;
  viewCount: number;
  favorite: boolean;
  progress: PlayProgressDto | null;
}

/** Fileira da home. */
export class PlayHomeSectionDto {
  id: string;
  kind: PlaySectionKind;
  title: string;
  categoryId?: string;
  galleryId?: string;
  videos: PlayVideoResponseDto[];
}

export class PlayHomeResponseDto {
  sections: PlayHomeSectionDto[];
}

export class PlayCategoryResponseDto {
  id: string;
  name: string;
  slug: string;
  position: number;
  /** Vídeos visíveis hoje no Play com esta categoria. */
  videoCount: number;
}

export class PlayVideoStatDto {
  id: string;
  title: string;
  galleryTitle: string;
  views: number;
  viewers: number;
  completed: number;
  lastViewedAt: string | null;
}

export class PlayStatsResponseDto {
  totalVideos: number;
  totalViews: number;
  totalViewers: number;
  videos: PlayVideoStatDto[];
}
