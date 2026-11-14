import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import { DocumentEntity } from './entities/document.entity';
import {
  DocumentMediaResponseDto,
  DocumentResponseDto,
} from './dto/document-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** O arquivo do documento no contrato público. */
export function toDocumentMediaResponse(
  media: MediaItemEntity,
): DocumentMediaResponseDto {
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

/** Contrato de resposta de `/documents`. */
export function toDocumentResponse(
  document: DocumentEntity,
  media?: MediaItemEntity | null,
): DocumentResponseDto {
  return {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    media: media ? toDocumentMediaResponse(media) : null,
    createdAt: toIsoString(document.createdAt),
    updatedAt: toIsoString(document.updatedAt),
  };
}
