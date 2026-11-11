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

/**
 * Filtro de ruído da observabilidade.
 *
 * Todo erro entra: 5xx e `Logger.error` como `error`, e respostas 4xx como
 * `warn`. Ficam de fora apenas os 4xx que não indicam problema:
 * - 401: token ausente/expirado ou senha errada (a tentativa fica na auditoria);
 * - 404 sem handler: varredura de rotas que não existem.
 */
export const CLIENT_ERROR_NOISE_STATUSES: ReadonlySet<number> = new Set([401]);
export const UNMATCHED_ROUTE_STATUS = 404;
export const CLIENT_ERROR_MIN_STATUS = 400;
export const CLIENT_ERROR_MAX_STATUS = 499;
/**
 * Contextos que só repetem um erro já registrado mais perto da causa: o
 * filtro global loga de novo a exceção que o serviço já logou.
 */
export const ECHO_LOG_CONTEXTS: ReadonlySet<string> = new Set([
  'GlobalExceptionFilter',
]);
/**
 * Janela de repetição: o primeiro registro de uma assinatura é gravado na
 * hora; os iguais dentro da janela são contados e viram um único resumo.
 */
export const REPEAT_WINDOW_MS = 60_000;
export const REPEAT_WINDOW_MAX_KEYS = 1000;
export const REPEAT_SUMMARY_PREFIX = (count: number, seconds: number): string =>
  `[repetido ${count}x em ${seconds}s] `;
/** Partes variáveis de uma mensagem, trocadas para comparar a forma dela. */
export const MESSAGE_SHAPE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id'],
  [/\d+/g, ':n'],
];
