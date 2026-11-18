import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AppValidationException, ErrorCode } from 'src/shared/exceptions';

import {
  DOCUMENT_ACCEPTED_FILE_TYPES,
  DOCUMENT_GENERIC_MIME_TYPES,
  DOCUMENT_PAYLOAD_FIELD,
} from './constants';

/**
 * Lê e valida o JSON enviado junto do arquivo, com as mesmas regras do
 * ValidationPipe global.
 *
 * O corpo multipart não passa pelo pipe global, e o tratamento anterior
 * transformava qualquer falha em "Erro ao processar dados do documento" — quem
 * enviava um campo errado não descobria qual era.
 */
export async function parseAndValidatePayload<T extends object>(
  raw: string | undefined,
  dtoClass: new () => T,
): Promise<T> {
  if (!raw) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      `${DOCUMENT_PAYLOAD_FIELD} é obrigatório`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      `${DOCUMENT_PAYLOAD_FIELD} deve conter um JSON válido`,
    );
  }

  const dto = plainToInstance(dtoClass, parsed);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const message = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join(' | ');

    throw new AppValidationException(
      ErrorCode.VALIDATION_ERROR,
      message || 'Dados inválidos na requisição',
    );
  }

  return dto;
}

/** Arquivo enviado para o campo declarado na mídia, quando houver. */
export function findMediaFile(
  files: Express.Multer.File[] | undefined,
  fileField: string | undefined,
): Express.Multer.File | undefined {
  if (!fileField) return undefined;
  return files?.find((file) => file.fieldname === fileField);
}

/**
 * Recusa arquivo que não seja PDF, DOCX ou PPTX. A extensão precisa ser uma das
 * aceitas e o MIME, quando informado com precisão, precisa combinar com ela.
 * Só olha o arquivo novo: documentos antigos (ex.: .doc) seguem editáveis.
 */
export function assertAcceptedDocumentFile(
  file: Express.Multer.File | undefined,
): void {
  if (!file) return;

  const name = file.originalname?.toLowerCase() ?? '';
  const extension = Object.keys(DOCUMENT_ACCEPTED_FILE_TYPES).find((ext) =>
    name.endsWith(ext),
  );
  const mime = (file.mimetype ?? '').toLowerCase();
  const mimeMatches =
    extension !== undefined &&
    (DOCUMENT_GENERIC_MIME_TYPES.includes(mime) ||
      DOCUMENT_ACCEPTED_FILE_TYPES[extension].includes(mime));

  if (!extension || !mimeMatches) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'Formato de arquivo não aceito. Envie um PDF, DOCX ou PPTX.',
    );
  }
}
