import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  FILE_DIRECTORY_MODE,
  FILE_EXTENSION,
  FILE_MODE,
  LOG_STORAGE_DEFAULTS,
  LogStorageEnv,
} from 'src/shared/providers/log-storage/constants';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';
import {
  emergencyWrite,
  resolveLocalDirectory,
  utcDayOf,
} from 'src/shared/providers/log-storage/utils';

import { BOOTSTRAP_FAILURE_CONTEXT } from '../constants';
import { LogLevel } from '../enums';
import { buildObservabilityRecord } from './observability-record.utils';

/**
 * Registra uma falha ocorrida antes de o container Nest existir.
 *
 * Sem injeção não há storage configurado; o melhor esforço é uma linha JSONL
 * na pasta local (quando o fluxo técnico é `file`) e o sinal em stderr. Nada
 * aqui lança: o erro original é o que importa.
 */
export function writeBootstrapFailure(
  error: unknown,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): void {
  const record = buildObservabilityRecord(
    {
      level: LogLevel.Fatal,
      context: BOOTSTRAP_FAILURE_CONTEXT,
      message: 'Falha ao iniciar a aplicação',
      error,
      sourceType: LogSourceType.Bootstrap,
    },
    {
      environment:
        env[LogStorageEnv.Environment]?.trim().toLowerCase() || 'unknown',
      ttlDays:
        Number(env[LogStorageEnv.ObsTtlDays]) || LOG_STORAGE_DEFAULTS.ttlDays,
      now,
      moduleName: 'AppModule',
      requestContext: null,
    },
  );

  emergencyWrite(BOOTSTRAP_FAILURE_CONTEXT, record.message, {
    errorName: record.errorName,
    errorMessage: record.errorMessage,
    eventId: record.eventId,
  });

  const storage = (
    env[LogStorageEnv.ObsStorage] ?? LOG_STORAGE_DEFAULTS.storage
  )
    .trim()
    .toLowerCase();
  if (storage !== LOG_STORAGE_DEFAULTS.storage) return;

  try {
    const directory = resolveLocalDirectory(
      env[LogStorageEnv.ObsLocalDir]?.trim() ||
        LOG_STORAGE_DEFAULTS.obsLocalDir,
      LogStorageEnv.ObsLocalDir,
    );
    mkdirSync(directory, { recursive: true, mode: FILE_DIRECTORY_MODE });
    appendFileSync(
      join(directory, `${utcDayOf(now)}.${process.pid}${FILE_EXTENSION}`),
      `${JSON.stringify(record)}\n`,
      { mode: FILE_MODE },
    );
  } catch {
    // stderr já recebeu o sinal; não há mais para onde escrever.
  }
}
