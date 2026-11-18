import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import {
  ImageSectionMediaResponseDto,
  ImageSectionResponseDto,
} from './dto/image-section-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Uma foto no contrato público. */
export function toImageSectionMediaResponse(
  media: MediaItemEntity,
): ImageSectionMediaResponseDto {
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

/** Contrato de resposta de `/image-sections`. */
export function toImageSectionResponse(
  section: ImageSectionEntity,
  mediaItems: MediaItemEntity[] = [],
): ImageSectionResponseDto {
  return {
    id: section.id,
    caption: section.caption,
    author: section.author?.name ? { name: section.author.name } : null,
    description: section.description,
    public: section.public,
    // A foto só deixa de estar pendente quando entra na página do feed.
    pageId: section.page?.id ?? null,
    mediaItems: mediaItems.map(toImageSectionMediaResponse),
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
