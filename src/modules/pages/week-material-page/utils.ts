import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import {
  WEEK_MATERIAL_DUPLICATE_FRAGMENT_LIMIT,
  WEEK_MATERIAL_INTERNAL_MARKERS_PATTERN,
  WEEK_MATERIAL_ORIGIN_MARKER_PREFIX,
  WEEK_MATERIAL_SPECIAL_TAG,
  WEEK_MATERIAL_WEEK_WORD,
} from './constants';
import {
  MulterFilesDict,
  WeekMaterialDuplicateCriteria,
  WeekMaterialMediaGroups,
  WeekMaterialMediaInput,
  WeekMaterialMediaSyncPlan,
} from './types';

/** Media types handled by a week material page, in presentation order. */
const MEDIA_INPUT_KEYS: ReadonlyArray<
  [keyof WeekMaterialMediaInput, MediaType]
> = [
  ['videos', MediaType.VIDEO],
  ['documents', MediaType.DOCUMENT],
  ['images', MediaType.IMAGE],
  ['audios', MediaType.AUDIO],
];

/** Indexes uploaded files by their multipart field name. */
export function buildFilesDict(
  files: Express.Multer.File[] = [],
): MulterFilesDict {
  return Object.fromEntries(files.map((file) => [file.fieldname, file]));
}

/**
 * Parses the JSON payload sent alongside the uploaded files and validates it
 * against the given DTO using the same rules as the global ValidationPipe.
 */
export async function parseAndValidatePayload<T extends object>(
  raw: string | undefined,
  dtoClass: new () => T,
): Promise<T> {
  if (!raw) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'weekMaterialsPageData é obrigatório',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'weekMaterialsPageData deve conter um JSON válido',
    );
  }

  const dto = plainToInstance(dtoClass, parsed);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw new AppValidationException(
      ErrorCode.VALIDATION_ERROR,
      'Dados inválidos na requisição',
    );
  }

  return dto;
}

/** True when the item must be persisted from an uploaded file instead of a URL. */
export function isUploadedMedia(item: MediaItemDto): boolean {
  return item.uploadType === UploadType.UPLOAD || item.isLocalFile === true;
}

/**
 * Flattens the media arrays of a request into a single list, forcing the media
 * type of each group and resolving the multipart field of uploaded files.
 */
export function normalizeIncomingMedia(
  input: WeekMaterialMediaInput,
): MediaItemDto[] {
  return MEDIA_INPUT_KEYS.flatMap(([key, mediaType]) =>
    (input[key] ?? []).map((item) => ({
      ...item,
      mediaType,
      fileField: isUploadedMedia(item) ? item.fieldKey : undefined,
    })),
  );
}

/** Rejects uploaded media that did not declare the multipart field of its file. */
export function assertUploadFieldKeys(items: MediaItemDto[]): void {
  for (const item of items) {
    if (isUploadedMedia(item) && !item.fileField) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FIELD_MISSING,
        `fieldKey ausente para item de mídia: ${item.title ?? ''}`,
      );
    }
  }
}

/**
 * Rejects new uploaded media whose declared file was not sent in the request,
 * before any deletion or upload happens.
 */
export function assertUploadFilesPresent(
  items: MediaItemDto[],
  filesDict: MulterFilesDict,
): void {
  for (const item of items) {
    if (!isUploadedMedia(item)) continue;
    resolveUploadedFile(item, filesDict);
  }
}

/** Resolves the uploaded file of a media item, failing when it was not sent. */
export function resolveUploadedFile(
  item: MediaItemDto,
  filesDict: MulterFilesDict,
): Express.Multer.File {
  if (!item.fileField) {
    throw new AppValidationException(
      ErrorCode.MEDIA_FIELD_MISSING,
      `fieldKey ausente para mídia "${item.title ?? ''}"`,
    );
  }

  const file = filesDict[item.fileField];
  if (!file) {
    throw new AppValidationException(
      ErrorCode.MEDIA_FILE_NOT_FOUND,
      `Arquivo ausente para mídia "${item.title ?? ''}"`,
    );
  }

  return file;
}

/** Groups persisted media items by media type. */
export function groupMediaByType(
  items: MediaItemEntity[],
): WeekMaterialMediaGroups {
  return {
    videos: items.filter((item) => item.mediaType === MediaType.VIDEO),
    documents: items.filter((item) => item.mediaType === MediaType.DOCUMENT),
    images: items.filter((item) => item.mediaType === MediaType.IMAGE),
    audios: items.filter((item) => item.mediaType === MediaType.AUDIO),
  };
}

/**
 * Diffs persisted media against the media sent by the client: items whose id
 * disappeared are removed, items with an id are updated and the rest is created.
 */
export function planMediaSync(
  existing: MediaItemEntity[],
  incoming: MediaItemDto[],
): WeekMaterialMediaSyncPlan {
  const incomingIds = new Set(
    incoming.map((item) => item.id).filter((id): id is string => Boolean(id)),
  );

  return {
    toRemove: existing.filter((item) => !incomingIds.has(item.id)),
    toUpdate: incoming.filter((item) => Boolean(item.id)),
    toCreate: incoming.filter((item) => !item.id),
  };
}

/** True when the description carries the Material Especial tag. */
export function isSpecialWeekMaterial(description?: string | null): boolean {
  return Boolean(description?.includes(WEEK_MATERIAL_SPECIAL_TAG));
}

/** Removes the internal markers (special tag, legacy origin) from public text. */
export function stripWeekMaterialMarkers(text?: string | null): string {
  return (text ?? '')
    .replace(WEEK_MATERIAL_INTERNAL_MARKERS_PATTERN, '')
    .trim();
}

/** Legacy origin marker of a lesson published before `sourceLessonId` existed. */
export function weekMaterialOriginMarker(lessonId: string): string {
  return `${WEEK_MATERIAL_ORIGIN_MARKER_PREFIX}${lessonId}]`;
}

/** Case, accent, punctuation and spacing insensitive form of a page title. */
export function normalizeWeekMaterialTitle(title?: string | null): string {
  return (title ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * True when the title names exactly this week number: "Semana 1" must not
 * match "Semana 12", and leading zeros are ignored.
 */
export function titleNamesWeek(
  title: string | null | undefined,
  weekNumber: number,
): boolean {
  const matches = normalizeWeekMaterialTitle(title).matchAll(
    /(?:^| )semana 0*(\d+)(?= |$)/g,
  );
  for (const match of matches) {
    if (Number(match[1]) === weekNumber) return true;
  }
  return false;
}

/**
 * Title fragments the database can narrow the duplicate search by: the word
 * "semana" plus the number for a weekly material, or the longest words of the
 * title for a special one. Empty when the title has nothing to search for.
 */
export function duplicateSearchFragments(
  criteria: WeekMaterialDuplicateCriteria,
): string[] {
  if (!criteria.special)
    return criteria.weekNumber
      ? [WEEK_MATERIAL_WEEK_WORD, String(criteria.weekNumber)]
      : [];
  return [...new Set(normalizeWeekMaterialTitle(criteria.title).split(' '))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .slice(0, WEEK_MATERIAL_DUPLICATE_FRAGMENT_LIMIT);
}

/** True when an existing page is the same material the criteria describe. */
export function isDuplicateWeekMaterial(
  page: { id: string; title: string; description?: string | null },
  criteria: WeekMaterialDuplicateCriteria,
): boolean {
  if (page.id === criteria.excludePageId) return false;
  if (criteria.special)
    return (
      normalizeWeekMaterialTitle(page.title) ===
      normalizeWeekMaterialTitle(criteria.title)
    );
  // A special material that mentions the week is not the weekly material.
  if (isSpecialWeekMaterial(page.description)) return false;
  return Boolean(
    criteria.weekNumber && titleNamesWeek(page.title, criteria.weekNumber),
  );
}
