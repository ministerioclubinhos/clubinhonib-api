import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { RouteEntity } from 'src/modules/routes/route-page.entity';
import { VideosPage } from './entities/video-page.entity';
import {
  VideoItemResponseDto,
  VideoRouteDto,
  VideosPageResponseDto,
} from './dto/videos-page-response.dto';

/**
 * Mapeia o vídeo para o contrato público.
 *
 * A resposta antiga devolvia a entidade inteira, expondo colunas internas como
 * `targetId` e `targetType`.
 */
export function toVideoResponse(item: MediaItemEntity): VideoItemResponseDto {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    uploadType: item.uploadType,
    mediaType: item.mediaType,
    platformType: item.platformType,
    url: item.url,
    isLocalFile: item.isLocalFile,
    originalName: item.originalName,
    size: item.size,
  };
}

/** Mapeia a rota da galeria para o contrato público. */
export function toRouteResponse(route: RouteEntity): VideoRouteDto {
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

/**
 * `route` é obrigatório no contrato, mas a relação é opcional no banco: uma
 * página sem rota é dado inconsistente e precisa ser detectada.
 */
export function hasRoute(page: VideosPage): boolean {
  return Boolean(page.route?.id);
}

/** Mapeia a galeria e seus vídeos para o contrato público. */
export function toVideosPageResponse(
  page: VideosPage,
  videos: MediaItemEntity[] = [],
): VideosPageResponseDto {
  if (!hasRoute(page)) {
    throw new AppNotFoundException(
      ErrorCode.ROUTE_NOT_FOUND,
      `A página de vídeos com id ${page.id} não possui rota associada.`,
    );
  }

  return {
    id: page.id,
    title: page.name,
    description: page.description,
    public: page.public,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    route: toRouteResponse(page.route),
    videos: videos.map(toVideoResponse),
  };
}
