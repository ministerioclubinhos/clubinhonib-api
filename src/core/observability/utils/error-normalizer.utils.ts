import { HttpException } from '@nestjs/common';

import { AppException } from 'src/shared/exceptions/base.exception';

import { LEADING_ERROR_CODE_PATTERN, STRING_MAX_LENGTH } from '../constants';
import { NormalizedError } from '../types';
import { redactText } from './redaction.utils';

/**
 * Reduz um `unknown` lançado a campos separados e redigidos.
 *
 * Nada do objeto original é persistido: nem `response`, nem `details`, nem
 * propriedades extras que um vendor tenha anexado.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof AppException) {
    return {
      name: error.name,
      message: redactText(error.message),
      code: error.code,
      statusCode: error.getStatus(),
      stack: error.stack ?? null,
    };
  }
  if (error instanceof HttpException) {
    return {
      name: error.name,
      message: redactText(error.message),
      code: null,
      statusCode: error.getStatus(),
      stack: error.stack ?? null,
    };
  }
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      name: error.name || 'Error',
      message: redactText(error.message),
      code:
        typeof code === 'string' || typeof code === 'number'
          ? String(code)
          : null,
      statusCode: null,
      stack: error.stack ?? null,
    };
  }
  if (typeof error === 'string') {
    return {
      name: null,
      message: redactText(error),
      code: null,
      statusCode: null,
      stack: null,
    };
  }
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    const name = (error as { name?: unknown }).name;
    return {
      name: typeof name === 'string' ? name : null,
      message: typeof message === 'string' ? redactText(message) : null,
      code: null,
      statusCode: null,
      stack: null,
    };
  }
  return {
    name: null,
    message: error === undefined ? null : redactText(unknownToText(error)),
    code: null,
    statusCode: null,
    stack: null,
  };
}

/** Extrai `[CODE_1234]` do início de uma mensagem do filtro global. */
export function leadingErrorCode(message: string): string | null {
  const match = LEADING_ERROR_CODE_PATTERN.exec(message);
  return match ? match[1] : null;
}

/** Converte a mensagem que chegou ao logger em texto seguro e limitado. */
export function messageToText(
  message: unknown,
  maxLength = STRING_MAX_LENGTH,
): string {
  if (typeof message === 'string') return redactText(message, maxLength);
  if (message instanceof Error) return redactText(message.message, maxLength);
  if (message === undefined || message === null) return '';
  if (typeof message === 'object') {
    try {
      return redactText(JSON.stringify(message), maxLength);
    } catch {
      return '[unserializable]';
    }
  }
  return redactText(unknownToText(message), maxLength);
}

/** Texto de um primitivo desconhecido, sem `[object Object]`. */
export function unknownToText(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    case 'symbol':
      return value.toString();
    case 'function':
      return '[function]';
    default:
      try {
        return JSON.stringify(value) ?? '';
      } catch {
        return '[unserializable]';
      }
  }
}
