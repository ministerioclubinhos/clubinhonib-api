import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import {
  IdeasSectionMediaResponseDto,
  IdeasSectionResponseDto,
} from './dto/ideas-section-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Uma mídia da seção no contrato público. */
export function toIdeasSectionMediaResponse(
  media: MediaItemEntity,
): IdeasSectionMediaResponseDto {
  return {
    id: media.id,
    title: media.title ?? null,
    description: media.description ?? null,
    uploadType: media.uploadType,
    mediaType: media.mediaType,
    isLocalFile: media.isLocalFile,
    url: media.url,
    platformType: media.platformType ?? null,
    originalName: media.originalName ?? null,
    size: media.size ?? null,
  };
}

/** Contrato de resposta de `/ideas-sections`. */
export function toIdeasSectionResponse(
  section: IdeasSectionEntity,
  medias: MediaItemEntity[] = [],
): IdeasSectionResponseDto {
  return {
    id: section.id,
    title: section.title,
    description: section.description,
    public: section.public,
    // A ideia só deixa de estar pendente quando é vinculada a uma página.
    pageId: section.page?.id ?? null,
    medias: medias.map(toIdeasSectionMediaResponse),
    createdAt: toIsoString(section.createdAt),
    updatedAt: toIsoString(section.updatedAt),
  };
}

/** Agrupa as mídias por seção, para montar uma lista sem N+1. */
export function groupMediasBySection(
  medias: MediaItemEntity[],
): Map<string, MediaItemEntity[]> {
  const grupos = new Map<string, MediaItemEntity[]>();

  for (const media of medias) {
    const atual = grupos.get(media.targetId);
    if (atual) atual.push(media);
    else grupos.set(media.targetId, [media]);
  }

  return grupos;
}
