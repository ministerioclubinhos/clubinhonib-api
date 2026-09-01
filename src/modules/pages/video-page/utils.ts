import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { MulterFilesDict, VideoSyncPlan } from './types';

/** Indexa os arquivos enviados pelo nome do campo multipart. */
export function buildFilesDict(
  files: Express.Multer.File[] = [],
): MulterFilesDict {
  return Object.fromEntries(files.map((file) => [file.fieldname, file]));
}

/** True quando o vídeo é um arquivo enviado, e não um link. */
export function isUploadedVideo(item: MediaItemDto): boolean {
  return item.uploadType === UploadType.UPLOAD || item.isLocalFile === true;
}

/** Preenche `fileField` a partir de `fieldKey` para as mídias enviadas. */
export function normalizeIncomingVideos(
  videos: MediaItemDto[] = [],
): MediaItemDto[] {
  return videos.map((item) => ({
    ...item,
    fileField: isUploadedVideo(item) ? item.fieldKey : undefined,
  }));
}

/** Recusa upload que não declarou o campo multipart do arquivo. */
export function assertUploadFieldKeys(items: MediaItemDto[]): void {
  for (const item of items) {
    if (isUploadedVideo(item) && !item.fileField) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FIELD_MISSING,
        `fieldKey ausente para o vídeo "${item.title ?? ''}"`,
      );
    }
  }
}

/** Recusa upload cujo arquivo não veio na requisição. */
export function assertUploadFilesPresent(
  items: MediaItemDto[],
  filesDict: MulterFilesDict,
): void {
  for (const item of items) {
    if (!isUploadedVideo(item)) continue;

    if (!item.fileField || !filesDict[item.fileField]) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FILE_NOT_FOUND,
        `Arquivo ausente para o vídeo "${item.title ?? ''}"`,
      );
    }
  }
}

/**
 * Diferencia os vídeos persistidos dos enviados: os que sumiram do payload são
 * removidos, os que têm id são atualizados e o restante é criado.
 */
export function planVideoSync(
  existing: MediaItemEntity[],
  incoming: MediaItemDto[],
): VideoSyncPlan {
  const incomingIds = new Set(
    incoming.map((item) => item.id).filter((id): id is string => Boolean(id)),
  );

  return {
    toRemove: existing.filter((item) => !incomingIds.has(item.id)),
    toUpdate: incoming.filter((item) => Boolean(item.id)),
    toCreate: incoming.filter((item) => !item.id),
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
      'videosPageData é obrigatório',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'videosPageData deve conter um JSON válido',
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
