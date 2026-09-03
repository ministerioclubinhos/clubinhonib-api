import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { RouteEntity } from 'src/modules/routes/route-page.entity';
import { ImagePageEntity } from './entity/Image-page.entity';
import { ImageSectionEntity } from './entity/Image-section.entity';
import {
  GalleryMediaItemDto,
  ImagePageResponseDto,
  ImageRouteDto,
  ImageSectionDto,
} from './dto/image-page-response.dto';
import { ImagePageSummaryDto } from './dto/image-page-summary.dto';
import { PaginatedImageSectionResponseDto } from './dto/paginated-image-section.dto';
import { MediaBySection } from './types';

/** Mapeia uma mídia da seção para o contrato público. */
export function toMediaItemResponse(
  item: MediaItemEntity,
): GalleryMediaItemDto {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    uploadType: item.uploadType,
    mediaType: item.mediaType,
    isLocalFile: item.isLocalFile,
    url: item.url,
    platformType: item.platformType,
    originalName: item.originalName,
    size: item.size,
  };
}

/** Mapeia a rota da galeria para o contrato público. */
export function toRouteResponse(route: RouteEntity): ImageRouteDto {
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

/** Mapeia uma seção e suas mídias para o contrato público. */
export function toSectionResponse(
  section: ImageSectionEntity,
  mediaItems: MediaItemEntity[] = [],
): ImageSectionDto {
  return {
    id: section.id,
    caption: section.caption,
    description: section.description,
    public: section.public,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt,
    mediaItems: mediaItems.map(toMediaItemResponse),
  };
}

/**
 * `route` é obrigatório no contrato, mas a relação é opcional no banco: uma
 * galeria sem rota é dado inconsistente e precisa ser detectada.
 */
export function hasRoute(page: ImagePageEntity): boolean {
  return Boolean(page.route?.id);
}

/** Mapeia a galeria, suas seções e mídias para o contrato público. */
export function toImagePageResponse(
  page: ImagePageEntity,
  mediaBySection: MediaBySection = new Map(),
): ImagePageResponseDto {
  if (!hasRoute(page)) {
    throw new AppNotFoundException(
      ErrorCode.ROUTE_NOT_FOUND,
      `A galeria com id ${page.id} não possui rota associada.`,
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
    sections: (page.sections ?? []).map((section) =>
      toSectionResponse(section, mediaBySection.get(section.id) ?? []),
    ),
  };
}

/** Monta a resposta paginada de seções de uma galeria. */
export function toPaginatedSectionsResponse(
  page: ImagePageEntity,
  sections: ImageSectionEntity[],
  mediaBySection: MediaBySection,
  pageNumber: number,
  limit: number,
  total: number,
): PaginatedImageSectionResponseDto {
  return {
    id: page.id,
    title: page.name,
    description: page.description,
    public: page.public,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    sections: sections.map((section) =>
      toSectionResponse(section, mediaBySection.get(section.id) ?? []),
    ),
    page: pageNumber,
    limit,
    total,
  };
}

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Mapeia a galeria para o resumo da listagem.
 *
 * Diferente de `toImagePageResponse`, uma galeria sem rota não derruba a
 * listagem: `routePath` volta `null` e o administrador consegue ver — e
 * corrigir — o registro inconsistente.
 */
export function toImagePageSummary(page: ImagePageEntity): ImagePageSummaryDto {
  return {
    id: page.id,
    title: page.name,
    description: page.description,
    public: page.public,
    routePath: page.route?.path ?? null,
    sectionCount: page.sectionCount ?? page.sections?.length ?? 0,
    createdAt: toIsoString(page.createdAt),
    updatedAt: toIsoString(page.updatedAt),
  };
}
