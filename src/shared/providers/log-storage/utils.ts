import { isAbsolute, relative, resolve, sep } from 'node:path';

import {
  AUDIT_DEDUP_SECONDS_MAX,
  FILE_STORAGE_FORBIDDEN_ENVIRONMENTS,
  LOG_RECORD_MAX_BYTES,
  LOG_STORAGE_DEFAULTS,
  LOG_TTL_DAYS_MAX,
  LOG_TTL_DAYS_MIN,
  LogStorageEnv,
} from './constants';
import { LogRecordType, LogStorageKind, LogStream } from './enums';
import {
  AuditStreamConfig,
  JsonValue,
  LogRecord,
  LogStorageConfig,
  QueryableRecordType,
  StreamConfig,
  StreamStorageConfig,
} from './types';

/** Lê uma variável de ambiente; `undefined` quando ausente ou vazia. */
export type EnvReader = (key: string) => string | undefined;

export class LogStorageConfigError extends Error {
  constructor(message: string) {
    super(`Configuração de observabilidade/auditoria inválida: ${message}`);
    this.name = 'LogStorageConfigError';
  }
}

const readTrimmed = (read: EnvReader, key: string): string | undefined => {
  const value = read(key);
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : undefined;
};

const parseIntegerInRange = (
  raw: string | undefined,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (raw === undefined) return fallback;
  if (!/^-?\d+$/.test(raw)) {
    throw new LogStorageConfigError(`${key} precisa ser um inteiro.`);
  }
  const value = Number(raw);
  if (value < min || value > max) {
    throw new LogStorageConfigError(
      `${key} precisa estar entre ${min} e ${max}.`,
    );
  }
  return value;
};

const parseStorageKind = (
  raw: string | undefined,
  key: string,
): { kind: LogStorageKind; explicit: boolean } => {
  if (raw === undefined) {
    return { kind: LogStorageKind.File, explicit: false };
  }
  const lowered = raw.toLowerCase();
  if (lowered === (LogStorageKind.File as string)) {
    return { kind: LogStorageKind.File, explicit: true };
  }
  if (lowered === (LogStorageKind.DynamoDb as string)) {
    return { kind: LogStorageKind.DynamoDb, explicit: true };
  }
  throw new LogStorageConfigError(
    `${key} aceita apenas "${LogStorageKind.File}" ou "${LogStorageKind.DynamoDb}".`,
  );
};

/**
 * Resolve o diretório local e recusa destino fora da raiz do processo.
 *
 * O caminho vem da configuração; um valor como `../../etc` gravaria fora da
 * pasta da aplicação e apagaria arquivos alheios na retenção.
 */
export function resolveLocalDirectory(
  rawDirectory: string,
  key: string,
  rootDirectory: string = process.cwd(),
): string {
  if (rawDirectory.includes('\0')) {
    throw new LogStorageConfigError(`${key} contém caractere inválido.`);
  }
  const resolved = resolve(rootDirectory, rawDirectory);
  const relativePath = relative(rootDirectory, resolved);
  const escapes =
    relativePath === '' ||
    relativePath.startsWith('..') ||
    isAbsolute(relativePath) ||
    relativePath.split(sep)[0] === '..';
  if (escapes) {
    throw new LogStorageConfigError(
      `${key} precisa apontar para uma pasta dentro de ${rootDirectory}.`,
    );
  }
  return resolved;
}

const parseStreamStorage = (
  read: EnvReader,
  environment: string,
  storageKey: string,
  dirKey: string,
  defaultDir: string,
  rootDirectory: string,
): StreamStorageConfig => {
  const { kind, explicit } = parseStorageKind(
    readTrimmed(read, storageKey),
    storageKey,
  );

  if (kind === LogStorageKind.File) {
    if (explicit && FILE_STORAGE_FORBIDDEN_ENVIRONMENTS.has(environment)) {
      throw new LogStorageConfigError(
        `${storageKey}=file não é aceito em ENVIRONMENT="${environment}": o container não tem volume persistente.`,
      );
    }
    const directory = readTrimmed(read, dirKey) ?? defaultDir;
    return {
      kind,
      directory: resolveLocalDirectory(directory, dirKey, rootDirectory),
    };
  }

  const tableName = readTrimmed(read, LogStorageEnv.DynamoTableName);
  if (!tableName) {
    throw new LogStorageConfigError(
      `${LogStorageEnv.DynamoTableName} é obrigatória quando ${storageKey}=dynamodb.`,
    );
  }
  const region = readTrimmed(read, LogStorageEnv.AwsRegion);
  if (!region) {
    throw new LogStorageConfigError(
      `${LogStorageEnv.AwsRegion} é obrigatória quando ${storageKey}=dynamodb.`,
    );
  }
  return {
    kind,
    tableName,
    region,
    endpoint: readTrimmed(read, LogStorageEnv.DynamoEndpoint) ?? null,
  };
};

/**
 * Monta e valida a configuração dos dois fluxos a partir do ambiente.
 *
 * Variável ausente recebe o valor fornecido na especificação; variável
 * presente e inválida derruba o boot com mensagem sem segredo.
 */
export function parseLogStorageConfig(
  read: EnvReader,
  rootDirectory: string = process.cwd(),
): LogStorageConfig {
  const environment =
    readTrimmed(read, LogStorageEnv.Environment)?.toLowerCase() ?? 'unknown';

  const observability: StreamConfig = {
    stream: LogStream.Observability,
    storage: parseStreamStorage(
      read,
      environment,
      LogStorageEnv.ObsStorage,
      LogStorageEnv.ObsLocalDir,
      LOG_STORAGE_DEFAULTS.obsLocalDir,
      rootDirectory,
    ),
    ttlDays: parseIntegerInRange(
      readTrimmed(read, LogStorageEnv.ObsTtlDays),
      LogStorageEnv.ObsTtlDays,
      LOG_STORAGE_DEFAULTS.ttlDays,
      LOG_TTL_DAYS_MIN,
      LOG_TTL_DAYS_MAX,
    ),
  };

  const audit: AuditStreamConfig = {
    stream: LogStream.Audit,
    storage: parseStreamStorage(
      read,
      environment,
      LogStorageEnv.AuditStorage,
      LogStorageEnv.AuditLocalDir,
      LOG_STORAGE_DEFAULTS.auditLocalDir,
      rootDirectory,
    ),
    ttlDays: parseIntegerInRange(
      readTrimmed(read, LogStorageEnv.AuditTtlDays),
      LogStorageEnv.AuditTtlDays,
      LOG_STORAGE_DEFAULTS.ttlDays,
      LOG_TTL_DAYS_MIN,
      LOG_TTL_DAYS_MAX,
    ),
    dedupSeconds: parseIntegerInRange(
      readTrimmed(read, LogStorageEnv.AuditDedupSeconds),
      LogStorageEnv.AuditDedupSeconds,
      LOG_STORAGE_DEFAULTS.dedupSeconds,
      0,
      AUDIT_DEDUP_SECONDS_MAX,
    ),
  };

  if (
    observability.storage.kind === LogStorageKind.File &&
    audit.storage.kind === LogStorageKind.File &&
    observability.storage.directory === audit.storage.directory
  ) {
    throw new LogStorageConfigError(
      `${LogStorageEnv.ObsLocalDir} e ${LogStorageEnv.AuditLocalDir} precisam ser pastas diferentes.`,
    );
  }

  return { environment, observability, audit };
}

/** `YYYY-MM-DD` em UTC do instante informado. */
export function utcDayOf(instant: Date | string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  return date.toISOString().slice(0, 10);
}

/** Todos os dias UTC entre dois instantes, do mais recente ao mais antigo. */
export function utcDaysBetweenDescending(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );
  const first = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  while (cursor.getTime() >= first) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days;
}

/** Segundos de época em que um registro expira. */
export function expiresAtEpochSeconds(
  occurredAt: Date,
  ttlDays: number,
): number {
  return Math.floor(occurredAt.getTime() / 1000) + ttlDays * 86_400;
}

/** Serializa e confere o tamanho; item grande é recusado antes do storage. */
export function serializeRecord(record: LogRecord): string {
  const line = JSON.stringify(record);
  if (Buffer.byteLength(line, 'utf8') > LOG_RECORD_MAX_BYTES) {
    throw new RangeError(
      `Registro ${record.eventId} excede ${LOG_RECORD_MAX_BYTES} bytes.`,
    );
  }
  return line;
}

/** Confere igualdade string a string com os filtros allowlisted. */
export function matchesFilters(
  record: LogRecord,
  filters: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(filters).every(([field, expected]) => {
    const value = record[field];
    return (
      value !== undefined &&
      value !== null &&
      primitiveToString(value) === expected
    );
  });
}

/** Texto de um valor JSON sem cair no `[object Object]`. */
export function primitiveToString(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Item cujo TTL já venceu, mas o storage ainda não removeu. */
export function isLogicallyExpired(record: LogRecord, now: Date): boolean {
  return record.expiresAtEpochSeconds <= Math.floor(now.getTime() / 1000);
}

/**
 * Escreve um sinal de emergência em stderr.
 *
 * É o único caminho de saída quando o próprio storage falha: passar pelo
 * logger da aplicação voltaria a tentar persistir e entraria em laço.
 */
export function emergencyWrite(
  component: string,
  message: string,
  detail?: JsonValue,
): void {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    component,
    message,
    detail: detail ?? null,
  });
  process.stderr.write(`[log-storage] ${line}\n`);
}

/** Descreve um erro sem carregar objetos brutos para o sinal de emergência. */
export function describeError(error: unknown): JsonValue {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return typeof error === 'string' ? error : String(error);
}

/** Recorte de uma lista já ordenada para a página pedida (`page` começa em 1). */
export function sliceForPage<T>(items: T[], page: number, limit: number): T[] {
  const start = (Math.max(1, page) - 1) * limit;
  return items.slice(start, start + limit);
}

/**
 * Tipos físicos que pertencem a um fluxo lógico: apagar auditoria leva junto as
 * repetições de janela, que só fazem sentido apontando para o evento apagado.
 */
export function physicalRecordTypes(
  recordType: QueryableRecordType,
): LogRecordType[] {
  return recordType === LogRecordType.Audit
    ? [LogRecordType.Audit, LogRecordType.AuditRepeat]
    : [LogRecordType.Observability];
}
