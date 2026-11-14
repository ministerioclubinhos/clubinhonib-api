import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemInput } from 'src/shared/media/media-item-processor';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { IdeasSectionEntity } from './entities/ideas-section.entity';
import { MediaBySection, MulterFilesDict, SectionSyncPlan } from './types';

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

/** Ids de todas as seções das páginas informadas. */
export function collectSectionIds(
  pages: { sections?: IdeasSectionEntity[] }[],
): string[] {
  return pages.flatMap((page) => (page.sections ?? []).map((s) => s.id));
}

/**
 * Diferencia as seções persistidas das enviadas: as que sumiram do payload são
 * removidas, as que têm id são atualizadas e o restante é criado.
 */
export function planSectionSync<TSection extends { id?: string }>(
  existing: IdeasSectionEntity[],
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

/**
 * Lê e valida o JSON enviado junto dos arquivos, com as mesmas regras do
 * ValidationPipe global.
 */
export async function parseAndValidatePayload<T extends object>(
  raw: string | undefined,
  dtoClass: new () => T,
): Promise<T> {
  if (!raw) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'ideasMaterialsPageData é obrigatório.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'ideasMaterialsPageData deve conter um JSON válido.',
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

/** Uma mídia é um arquivo novo quando veio marcada como upload local. */
export function isUploadedMedia(item: MediaItemDto): boolean {
  return item.uploadType === UploadType.UPLOAD && item.isLocalFile === true;
}

/**
 * Toda mídia enviada como upload precisa do arquivo correspondente. Vale só
 * para mídias novas: as já gravadas chegam sem `fieldKey` e sem arquivo.
 */
export function assertUploadsHaveFiles(
  items: MediaItemDto[],
  filesDict: MulterFilesDict,
): void {
  for (const item of items.filter(isUploadedMedia)) {
    if (!item.fieldKey) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FIELD_MISSING,
        `fieldKey ausente para a mídia "${item.title ?? ''}"`,
      );
    }

    if (!filesDict[item.fieldKey]) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FILE_NOT_FOUND,
        `Arquivo ausente para a mídia "${item.title ?? ''}"`,
      );
    }
  }
}

/**
 * O processador de mídias localiza o arquivo por `fileField`; o cliente envia
 * o mesmo dado como `fieldKey`.
 */
export function toMediaItemInputs(items: MediaItemDto[]): MediaItemInput[] {
  return items.map((item) => ({
    ...item,
    fileField: item.fieldKey ?? item.fileField,
  }));
}
