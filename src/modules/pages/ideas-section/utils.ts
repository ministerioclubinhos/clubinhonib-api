import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';

import { IdeasSectionMediaItemDto } from './dto/ideas-section-media-item.dto';
import { UploadedFilesDict } from './types';
import { IdeasSectionMediaType } from './entities/ideas-section-media-type.enum';
import {
  IDEAS_MEDIA_TITLE_MAX_LENGTH,
  IDEAS_MEDIA_TITLE_SEPARATOR,
  IDEAS_MEDIA_TYPE_LABELS,
} from './constants';

/** Construtor de DTO, do jeito que `plainToInstance` espera. */
type DtoClass<T> = new () => T;

/**
 * Lê o JSON que veio junto dos arquivos e valida contra o DTO.
 *
 * O corpo chega como multipart, então o `ValidationPipe` global não o alcança:
 * a validação precisa acontecer aqui. Os três manipuladores faziam esta mesma
 * sequência copiada, e cada cópia tratava a falha de um jeito.
 */
export async function parseSectionPayload<T extends object>(
  dtoClass: DtoClass<T>,
  raw: string | Buffer | undefined,
): Promise<T> {
  if (!raw) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'Os dados da seção são obrigatórios.',
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString() : raw) as Record<
      string,
      unknown
    >;
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'Os dados da seção não são um JSON válido.',
    );
  }

  const dto = plainToInstance(dtoClass, parsed);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    // A primeira mensagem já diz o que corrigir; o objeto inteiro do
    // class-validator não ajuda quem está do outro lado.
    const primeira = errors[0];
    const mensagem = primeira.constraints
      ? Object.values(primeira.constraints)[0]
      : `Campo inválido: ${primeira.property}`;

    throw new AppValidationException(ErrorCode.VALIDATION_ERROR, mensagem);
  }

  return dto;
}

/** Arquivos do multipart indexados pelo nome do campo. */
export function toFilesDict(
  files: Express.Multer.File[] = [],
): UploadedFilesDict {
  return files.reduce<UploadedFilesDict>((dict, file) => {
    dict[file.fieldname] = file;
    return dict;
  }, {});
}

/**
 * Confere que todo upload declarado tem arquivo correspondente.
 *
 * A checagem existia e nunca era chamada: uma mídia marcada como upload sem o
 * arquivo virava uma linha apontando para lugar nenhum.
 */
export function assertUploadsHaveFiles(
  medias: IdeasSectionMediaItemDto[] | undefined,
  filesDict: UploadedFilesDict,
): void {
  for (const [index, media] of (medias ?? []).entries()) {
    const isUpload =
      media.uploadType === UploadType.UPLOAD && media.isLocalFile;
    if (!isUpload) continue;
    const label = media.originalName?.trim() || `arquivo ${index + 1}`;

    if (!media.originalName) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FIELD_MISSING,
        `A mídia ${index + 1} está sem o nome do arquivo.`,
      );
    }

    if (!media.fieldKey || !filesDict[media.fieldKey]) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FILE_NOT_FOUND,
        `O arquivo "${label}" não veio na requisição.`,
      );
    }
  }
}

export function buildIdeasMediaTitle(
  sectionTitle: string,
  mediaType: IdeasSectionMediaType,
  position: number,
): string {
  const label = IDEAS_MEDIA_TYPE_LABELS[mediaType];
  const prefix = `${label} ${position}${IDEAS_MEDIA_TITLE_SEPARATOR}`;
  const title = `${prefix}${sectionTitle.trim()}`.trim();
  return title.length <= IDEAS_MEDIA_TITLE_MAX_LENGTH
    ? title
    : `${prefix}${sectionTitle.trim().slice(0, IDEAS_MEDIA_TITLE_MAX_LENGTH - prefix.length)}`;
}

export function applyGeneratedMediaMetadata<
  T extends {
    mediaType: IdeasSectionMediaType;
    title?: string;
    description?: string;
  },
>(medias: T[], sectionTitle: string): T[] {
  const positions = new Map<IdeasSectionMediaType, number>();
  return medias.map((media) => {
    const position = (positions.get(media.mediaType) ?? 0) + 1;
    positions.set(media.mediaType, position);
    return {
      ...media,
      title: buildIdeasMediaTitle(sectionTitle, media.mediaType, position),
      description: '',
    };
  });
}

export function isGeneratedMediaTitle(
  title: string,
  sectionTitle: string,
): boolean {
  return title.endsWith(`${IDEAS_MEDIA_TITLE_SEPARATOR}${sectionTitle.trim()}`);
}

export function applyAdminMediaMetadata<
  T extends {
    id?: string;
    mediaType: IdeasSectionMediaType;
    title?: string;
    description?: string;
  },
>(medias: T[], sectionTitle: string, previousSectionTitle: string): T[] {
  const positions = new Map<IdeasSectionMediaType, number>();
  return medias.map((media) => {
    const position = (positions.get(media.mediaType) ?? 0) + 1;
    positions.set(media.mediaType, position);
    const generated =
      !media.title?.trim() ||
      (!media.id && !media.title) ||
      isGeneratedMediaTitle(media.title ?? '', previousSectionTitle);
    if (!generated) return media;
    return {
      ...media,
      title: buildIdeasMediaTitle(sectionTitle, media.mediaType, position),
      description: media.id ? (media.description ?? '') : '',
    };
  });
}
