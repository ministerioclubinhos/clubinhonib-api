import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { WeekMaterialsPageEntity } from './entities/week-material-page.entity';
import {
  WeekMaterialMediaItemResponseDTO,
  WeekMaterialRouteResponseDTO,
  WeekMaterialsPageResponseDTO,
} from './dto/week-material-response.dto';
import { groupMediaByType } from './utils';

/** Maps a persisted media item to its public contract. */
export function toMediaItemResponse(
  item: MediaItemEntity,
): WeekMaterialMediaItemResponseDTO {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    uploadType: item.uploadType,
    mediaType: item.mediaType,
    platformType: item.platformType,
    url: item.url,
    isLocalFile: item.isLocalFile,
    size: item.size,
    originalName: item.originalName,
  };
}

/**
 * A relação com a rota é opcional no banco, mas `route` é obrigatório no
 * contrato: uma página sem rota é dado inconsistente e precisa ser detectada.
 */
export function hasRoute(page: WeekMaterialsPageEntity): boolean {
  return Boolean(page.route?.id);
}

/** Maps the route of a week material page to its public contract. */
export function toRouteResponse(
  page: WeekMaterialsPageEntity,
): WeekMaterialRouteResponseDTO {
  if (!hasRoute(page)) {
    throw new AppNotFoundException(
      ErrorCode.ROUTE_NOT_FOUND,
      'Rota não encontrada',
    );
  }

  return {
    id: page.route.id,
    path: page.route.path,
    title: page.route.title,
    subtitle: page.route.subtitle,
    description: page.route.description,
    type: page.route.type,
    public: page.route.public,
  };
}

/** Maps a week material page and its media items to the public response DTO. */
export function toWeekMaterialsPageResponse(
  page: WeekMaterialsPageEntity,
  mediaItems: MediaItemEntity[] = [],
): WeekMaterialsPageResponseDTO {
  const grouped = groupMediaByType(mediaItems);

  return {
    id: page.id,
    title: page.title,
    subtitle: page.subtitle,
    description: page.description,
    currentWeek: page.currentWeek,
    route: toRouteResponse(page),
    videos: grouped.videos.map(toMediaItemResponse),
    documents: grouped.documents.map(toMediaItemResponse),
    images: grouped.images.map(toMediaItemResponse),
    audios: grouped.audios.map(toMediaItemResponse),
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}
