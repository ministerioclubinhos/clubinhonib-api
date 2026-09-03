import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';

import { IdeasSectionMediaItemDto } from './dto/ideas-section-media-item.dto';
import { UploadedFilesDict } from './types';

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
  for (const media of medias ?? []) {
    const isUpload =
      media.uploadType === UploadType.UPLOAD && media.isLocalFile;
    if (!isUpload) continue;

    if (!media.originalName) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FIELD_MISSING,
        `A mídia "${media.title ?? 'sem título'}" está sem o nome do arquivo.`,
      );
    }

    if (!media.fieldKey || !filesDict[media.fieldKey]) {
      throw new AppValidationException(
        ErrorCode.MEDIA_FILE_NOT_FOUND,
        `O arquivo da mídia "${media.title ?? 'sem título'}" não veio na requisição.`,
      );
    }
  }
}
