import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { ImageSectionEntity } from './entity/Image-section.entity';
import {
  assertMediaLinksAt,
  parseAndValidatePayload as parseAndValidateSharedPayload,
} from 'src/shared/media/payload-validation';
import { IMAGE_PAGE_PAYLOAD_FIELD, IMAGE_PAYLOAD_LABELS } from './constants';
import {
  CelebrationRow,
  CelebrationSummary,
  MediaBySection,
  MulterFilesDict,
  SectionSyncPlan,
} from './types';

/** Indexa os arquivos enviados pelo nome do campo multipart. */
export function buildFilesDict(
  files: Express.Multer.File[] = [],
): MulterFilesDict {
  return Object.fromEntries(files.map((file) => [file.fieldname, file]));
}

/** Agrupa mídias pelo id da seção a que pertencem. */
export function groupMediaBySection(
  mediaItems: MediaItemEntity[],
): MediaBySection {
  const grouped: MediaBySection = new Map();

  for (const item of mediaItems) {
    const bucket = grouped.get(item.targetId);
    if (bucket) {
      bucket.push(item);
    } else {
      grouped.set(item.targetId, [item]);
    }
  }

  return grouped;
}

/** Ids de todas as seções das galerias informadas. */
export function collectSectionIds(
  pages: { sections?: ImageSectionEntity[] }[],
): string[] {
  return pages.flatMap((page) => (page.sections ?? []).map((s) => s.id));
}

/**
 * Diferencia as seções persistidas das enviadas: as que sumiram do payload são
 * removidas, as que têm id são atualizadas e o restante é criado.
 */
export function planSectionSync<TSection extends { id?: string }>(
  existing: ImageSectionEntity[],
  incoming: TSection[],
): SectionSyncPlan<TSection> {
  const incomingIds = new Set(
    incoming
      .map((section) => section.id)
      .filter((id): id is string => Boolean(id)),
  );

  return {
    toRemove: existing
      .filter((section) => !incomingIds.has(section.id))
      .map((section) => section.id),
    toUpdate: incoming.filter((section) => Boolean(section.id)),
    toCreate: incoming.filter((section) => !section.id),
  };
}

/** Lê e valida o JSON `imageData`, com erros por seção e imagem. */
export function parseAndValidatePayload<T extends object>(
  raw: string | undefined,
  dtoClass: new () => T,
): Promise<T> {
  return parseAndValidateSharedPayload(
    raw,
    dtoClass,
    IMAGE_PAGE_PAYLOAD_FIELD,
    IMAGE_PAYLOAD_LABELS,
  );
}

/** Agrupa as celebrações por seção, preservando a ordem de chegada. */
export function summarizeCelebrations(
  rows: CelebrationRow[],
  currentUserId: string | null,
): Map<string, CelebrationSummary> {
  const bySection = new Map<string, CelebrationSummary>();
  for (const row of rows) {
    const summary = bySection.get(row.sectionId) ?? {
      count: 0,
      names: [],
      celebratedByMe: false,
    };
    summary.count++;
    summary.names.push(row.userName);
    if (currentUserId && row.userId === currentUserId)
      summary.celebratedByMe = true;
    bySection.set(row.sectionId, summary);
  }
  return bySection;
}

/**
 * Toda imagem nova enviada como upload precisa do arquivo no multipart. As já
 * gravadas voltam do cliente só com o id e a URL, sem `fieldKey`.
 */
export function assertNewUploadsHaveFiles(
  items: MediaItemDto[],
  filesDict: MulterFilesDict,
): void {
  for (const item of items) {
    if (item.uploadType !== UploadType.UPLOAD) continue;
    const fieldKey = item.fieldKey ?? item.fileField;
    if (item.id && !fieldKey) continue;
    if (!fieldKey) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FIELD_MISSING,
        `fieldKey ausente para a mídia "${item.title ?? ''}"`,
      );
    }
    if (!Object.hasOwn(filesDict, fieldKey)) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FILE_NOT_FOUND,
        `Arquivo ausente para a mídia "${item.title ?? ''}"`,
      );
    }
  }
}

/** Recusa link inválido apontando a seção e a imagem. */
export function assertSectionMediaLinks(
  sections: { mediaItems: MediaItemDto[] }[],
): void {
  sections.forEach((section, sectionIndex) =>
    assertMediaLinksAt(section.mediaItems, (mediaIndex) => ({
      field: `sections.${sectionIndex}.mediaItems.${mediaIndex}.url`,
      label: `Seção ${sectionIndex + 1} · Imagem ${mediaIndex + 1}`,
    })),
  );
}
