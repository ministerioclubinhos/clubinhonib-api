import { LogLevel } from './enums';

export const OBSERVABILITY_SCHEMA_VERSION = '1';

/**
 * Níveis que vão para o storage (D-011). Os demais continuam só no stdout:
 * "todos os erros" é obrigatório; `warn`/`log` já saem no console e um 4xx já
 * fica na auditoria com código e resultado.
 */
export const PERSISTED_LOG_LEVELS: ReadonlySet<LogLevel> = new Set([
  LogLevel.Error,
  LogLevel.Fatal,
]);

export const MESSAGE_MAX_LENGTH = 1024;
export const STRING_MAX_LENGTH = 2048;
export const STACK_MAX_FRAMES = 20;
export const STACK_MAX_LENGTH = 8192;
export const METADATA_MAX_DEPTH = 3;
export const METADATA_MAX_KEYS = 20;
export const METADATA_MAX_ARRAY = 20;
export const FINGERPRINT_FRAMES = 5;
export const FINGERPRINT_LENGTH = 16;

export const TRUNCATION_MARKER = '…[truncated]';
export const REDACTED_MARKER = '[REDACTED]';

/** Chaves cujo valor nunca é persistido, comparadas em minúsculas. */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'cookies',
  'set-cookie',
  'password',
  'senha',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'secret',
  'apikey',
  'api_key',
  'cpf',
  'email',
  'phone',
  'telefone',
  'guardianname',
  'guardianphone',
  'name',
  'nome',
  'notes',
  'buffer',
  'originalname',
  'filename',
  'recoverycode',
  'verificationcode',
  'resetcode',
  'payload',
  'body',
  'response',
]);

/** Fragmentos que, presentes na chave, também a marcam como sensível. */
export const SENSITIVE_KEY_FRAGMENTS: readonly string[] = [
  'token',
  'password',
  'secret',
  'credential',
];

/** Únicas chaves de metadata aceitas no evento técnico. */
export const METADATA_KEY_ALLOWLIST: ReadonlySet<string> = new Set([
  'operation',
  'providerName',
  'jobName',
  'resourceType',
  'resourceId',
  'statusCode',
  'durationMs',
  'attempt',
  'count',
  'entity',
  'id',
  'key',
  'reason',
  'httpMethod',
  'routeTemplate',
  'errorCode',
  'table',
  'bucket',
  'jobStatus',
  'queue',
]);

/** Padrão que o Nest usa para reconhecer um stack trace entre os parâmetros. */
export const STACK_FORMAT_PATTERN = /^(.)+\n\s+at .+:\d+:\d+/;

/** Código de erro do filtro, ex.: `[USER_2001] mensagem`. */
export const LEADING_ERROR_CODE_PATTERN = /^\[([A-Z]+_\d{4})\]\s*/;

export const OBSERVABILITY_QUEUE_NAME = 'observability';
export const PROCESS_FLUSH_TIMEOUT_MS = 3000;
export const BOOTSTRAP_FAILURE_CONTEXT = 'Bootstrap';
