import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { ImageSectionEntity } from './entity/Image-section.entity';
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
      'imageData é obrigatório',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'imageData deve conter um JSON válido',
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
