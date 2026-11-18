import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AppValidationException, ErrorCode } from 'src/shared/exceptions';

import { UploadedFilesDict } from './types';

/** Construtor de DTO, do jeito que `plainToInstance` espera. */
type DtoClass<T> = new () => T;

/**
 * Lê o JSON que veio junto dos arquivos e valida contra o DTO.
 *
 * O corpo chega como multipart, então o `ValidationPipe` global não o alcança:
 * a validação precisa acontecer aqui.
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
