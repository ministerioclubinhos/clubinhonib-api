import {
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { parseYoutubeVideoId } from 'src/shared/media/youtube-url';
import {
  PlayCategoryResponseDto,
  PlayProgressDto,
  PlayVideoResponseDto,
} from './dto/play-video-response.dto';
import { CategoryCountRow } from './repositories/play-video-entry.repository';
import { PlayVideoRow } from './types';

/** O driver devolve booleanos como 0/1 nas consultas cruas. */
const toBool = (value: number | boolean | string | null | undefined): boolean =>
  value === true || value === 1 || value === '1';

/** Miniatura enviada, ou a do próprio YouTube; uploads sem miniatura ficam sem. */
export function resolveThumbnail(row: PlayVideoRow): string | null {
  if (row.thumbnailUrl) return row.thumbnailUrl;
  if (row.platformType === PlatformType.YOUTUBE) {
    const id = parseYoutubeVideoId(row.url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

function toProgress(row: PlayVideoRow): PlayProgressDto | null {
  if (row.progressPosition === null || row.progressPosition === undefined) {
    return null;
  }
  return {
    positionSeconds: Number(row.progressPosition),
    durationSeconds:
      row.progressDuration === null || row.progressDuration === undefined
        ? null
        : Number(row.progressDuration),
    completed: toBool(row.progressCompleted),
  };
}

export function toPlayVideoResponse(row: PlayVideoRow): PlayVideoResponseDto {
  const progress = toProgress(row);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    uploadType: row.uploadType as UploadType,
    platformType: (row.platformType as PlatformType | null) ?? undefined,
    url: row.url,
    isLocalFile: toBool(row.isLocalFile),
    originalName: row.originalName ?? undefined,
    size: row.size ?? undefined,
    galleryId: row.galleryId,
    galleryTitle: row.galleryTitle,
    featured: toBool(row.featured),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    thumbnailUrl: resolveThumbnail(row),
    durationSeconds:
      row.durationSeconds !== null && row.durationSeconds !== undefined
        ? Number(row.durationSeconds)
        : (progress?.durationSeconds ?? null),
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    viewCount: Number(row.viewCount ?? 0),
    favorite: toBool(row.favorite),
    progress,
  };
}

export function toCategoryResponse(
  row: CategoryCountRow,
): PlayCategoryResponseDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    position: Number(row.position),
    videoCount: Number(row.videoCount),
  };
}
