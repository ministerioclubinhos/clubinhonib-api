import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { RouteEntity } from 'src/modules/routes/route-page.entity';
import { IdeasPageEntity } from './entities/ideas-page.entity';
import { IdeasSectionEntity } from './entities/ideas-section.entity';
import {
  IdeasMediaItemResponseDto,
  IdeasPageResponseDto,
  IdeasRouteDto,
  IdeasSectionResponseDto,
} from './dto/ideas-page-response.dto';
import { IdeasPageSummaryDto } from './dto/ideas-page-summary.dto';
import { MediaBySection } from './types';

/** Mapeia uma mídia da seção para o contrato público. */
export function toMediaItemResponse(
  item: MediaItemEntity,
): IdeasMediaItemResponseDto {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    mediaType: item.mediaType,
    // Registros antigos podem não ter `uploadType`; o modo é deduzido de onde
    // o arquivo está guardado.
    uploadType:
      item.uploadType ||
      (item.isLocalFile ? UploadType.UPLOAD : UploadType.LINK),
    platformType: item.platformType || undefined,
    url: item.url,
    isLocalFile: item.isLocalFile,
    originalName: item.originalName || undefined,
    size: item.size || undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/** Mapeia a rota da página para o contrato público. */
export function toRouteResponse(route: RouteEntity): IdeasRouteDto {
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
  section: IdeasSectionEntity,
  mediaItems: MediaItemEntity[] = [],
): IdeasSectionResponseDto {
  return {
    id: section.id,
    title: section.title,
    description: section.description,
    public: section.public,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt,
    medias: mediaItems.map(toMediaItemResponse),
  };
}

/**
 * `route` é obrigatório no contrato, mas a relação é anulável no banco: uma
 * página sem rota é dado inconsistente e precisa ser detectada.
 */
export function hasRoute(page: IdeasPageEntity): boolean {
  return Boolean(page.route?.id);
}

/** Mapeia a página, suas seções e mídias para o contrato público. */
export function toIdeasPageResponse(
  page: IdeasPageEntity,
  mediaBySection: MediaBySection = new Map(),
): IdeasPageResponseDto {
  if (!hasRoute(page) || !page.route) {
    throw new AppNotFoundException(
      ErrorCode.ROUTE_NOT_FOUND,
      `Página de ideias id=${page.id} não possui rota associada.`,
    );
  }

  return {
    id: page.id,
    title: page.title,
    subtitle: page.subtitle || '',
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

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Mapeia a página para o resumo da listagem.
 *
 * Diferente de `toIdeasPageResponse`, uma página sem rota não derruba a
 * listagem: `routePath` volta `null` e o administrador consegue ver — e
 * corrigir — o registro inconsistente.
 */
export function toIdeasPageSummary(page: IdeasPageEntity): IdeasPageSummaryDto {
  return {
    id: page.id,
    title: page.title,
    subtitle: page.subtitle ?? '',
    description: page.description,
    public: page.public,
    routePath: page.route?.path ?? null,
    sectionCount: page.sectionCount ?? page.sections?.length ?? 0,
    createdAt: toIsoString(page.createdAt),
    updatedAt: toIsoString(page.updatedAt),
  };
}
