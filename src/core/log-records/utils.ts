import { HttpStatus } from '@nestjs/common';

import {
  AppException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { LogStorageKind } from 'src/shared/providers/log-storage/enums';
import { LogRecordStorage } from 'src/shared/providers/log-storage/ports/log-storage.port';
import { LogRecordFilters } from 'src/shared/providers/log-storage/types';

import { LOG_RECORDS_MAX_RANGE_DAYS } from './constants';
import { ValidatedRange } from './types';

const DAY_MS = 86_400_000;

/**
 * Valida o intervalo: datas reais, `from` antes de `to` e no máximo o limite
 * de dias. Recusa antes de qualquer acesso ao storage.
 */
export function validateRange(
  from: string,
  to: string,
  maxDays: number = LOG_RECORDS_MAX_RANGE_DAYS,
): ValidatedRange {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppValidationException(
      ErrorCode.INVALID_DATE_RANGE,
      'Período inválido',
    );
  }
  if (start.getTime() >= end.getTime()) {
    throw new AppValidationException(
      ErrorCode.INVALID_DATE_RANGE,
      'O início do período precisa ser anterior ao fim',
      { field: 'from' },
    );
  }
  if (end.getTime() - start.getTime() > maxDays * DAY_MS) {
    throw new AppValidationException(
      ErrorCode.INVALID_DATE_RANGE,
      `O período não pode passar de ${maxDays} dias`,
      { field: 'to', maxDays },
    );
  }
  return { from: start, to: end };
}

/** Só os campos allowlisted, e só os que vieram preenchidos. */
export function pickFilters<T extends object>(
  query: T,
  fields: readonly (keyof T & string)[],
): LogRecordFilters {
  const filters: Record<string, string> = {};
  for (const field of fields) {
    const value = query[field];
    if (typeof value === 'string' && value.trim())
      filters[field] = value.trim();
  }
  return filters;
}

/**
 * Recusa consulta/exclusão quando o storage não as atende.
 *
 * Com `file`, os JSONL existem para análise fora da aplicação; a API responde
 * `409 LOG_9101` em vez de fingir uma listagem vazia.
 */
export function assertQueryable(
  storage: Pick<LogRecordStorage, 'queryable'>,
  kind: LogStorageKind,
): void {
  if (storage.queryable) return;
  throw new AppException(
    ErrorCode.LOG_QUERY_UNAVAILABLE,
    `Consulta e exclusão indisponíveis: o storage "${kind}" grava apenas arquivos para análise. Configure "dynamodb" para usar esta tela.`,
    HttpStatus.CONFLICT,
    { storage: kind },
  );
}
