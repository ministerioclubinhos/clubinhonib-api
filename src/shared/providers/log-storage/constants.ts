import { DeliveryQueueOptions } from './types';

export const LOG_STORAGE_CONFIG = Symbol('LOG_STORAGE_CONFIG');
export const LOG_STORAGE_CLOCK = Symbol('LOG_STORAGE_CLOCK');
export const DYNAMODB_DOCUMENT_CLIENT = Symbol('DYNAMODB_DOCUMENT_CLIENT');

export const LOG_SERVICE_NAME = 'clubinhonib-api';
export const LOG_SCHEMA_VERSION = '1';

/** Variáveis de ambiente lidas pelo parser de configuração. */
export const LogStorageEnv = {
  Environment: 'ENVIRONMENT',
  ObsStorage: 'OBS_STORAGE',
  ObsLocalDir: 'OBS_LOCAL_DIR',
  ObsTtlDays: 'OBS_TTL_DAYS',
  AuditStorage: 'AUDIT_STORAGE',
  AuditLocalDir: 'AUDIT_LOCAL_DIR',
  AuditTtlDays: 'AUDIT_TTL_DAYS',
  AuditDedupSeconds: 'AUDIT_DEDUP_SECONDS',
  DynamoTableName: 'LOG_DYNAMODB_TABLE_NAME',
  DynamoEndpoint: 'LOG_DYNAMODB_ENDPOINT',
  AwsRegion: 'AWS_REGION',
} as const;

/** Valores usados quando a variável está ausente (iguais aos fornecidos). */
export const LOG_STORAGE_DEFAULTS = {
  storage: 'file',
  obsLocalDir: 'logs',
  auditLocalDir: 'audit',
  ttlDays: 1,
  dedupSeconds: 60,
} as const;

export const LOG_TTL_DAYS_MIN = 1;
export const LOG_TTL_DAYS_MAX = 3650;
export const AUDIT_DEDUP_SECONDS_MAX = 86_400;

/** Ambientes em que `file` não é aceito por configuração explícita. */
export const FILE_STORAGE_FORBIDDEN_ENVIRONMENTS: ReadonlySet<string> = new Set(
  ['staging', 'prod', 'production'],
);

export const DEFAULT_DELIVERY_QUEUE_OPTIONS: DeliveryQueueOptions = {
  maxQueueSize: 1000,
  writeTimeoutMs: 3000,
  maxAttempts: 2,
  retryDelayMs: 200,
  drainTimeoutMs: 5000,
};

/** Bem abaixo dos 400 KB do DynamoDB; acima disso o item é rejeitado local. */
export const LOG_RECORD_MAX_BYTES = 65_536;

export const FILE_DIRECTORY_MODE = 0o700;
export const FILE_MODE = 0o600;
export const FILE_EXTENSION = '.jsonl';
/** `YYYY-MM-DD.<pid>.jsonl` — um arquivo por dia UTC e por processo. */
export const FILE_NAME_PATTERN = /^(\d{4}-\d{2}-\d{2})\.(\d+)\.jsonl$/;
export const FILE_RETENTION_INTERVAL_MS = 60 * 60 * 1000;
/** Marcadores de dedup em memória são podados quando passam disso. */
export const FILE_DEDUP_MAX_ENTRIES = 10_000;

export const DYNAMO_PK = 'pk';
export const DYNAMO_SK = 'sk';
export const DYNAMO_GSI1_NAME = 'gsi1-request';
export const DYNAMO_GSI1_PK = 'gsi1pk';
export const DYNAMO_GSI1_SK = 'gsi1sk';
export const DYNAMO_TTL_ATTRIBUTE = 'expiresAtEpochSeconds';
export const DYNAMO_STREAM_PREFIX = 'STREAM';
export const DYNAMO_REQUEST_PREFIX = 'REQUEST';
export const DYNAMO_DEDUP_PREFIX = 'DEDUP';
export const DYNAMO_DEDUP_SK = 'DEDUP';
export const DYNAMO_MAX_ATTEMPTS = 3;
/** Limite do `BatchWriteItem`. */
export const DYNAMO_BATCH_SIZE = 25;
export const DYNAMO_BATCH_MAX_ATTEMPTS = 3;
/** Espera pela tabela recém-criada no DynamoDB Local. */
export const DYNAMO_TABLE_READY_ATTEMPTS = 20;
export const DYNAMO_TABLE_READY_DELAY_MS = 500;
export const DYNAMO_REQUEST_TIMEOUT_MS = 3000;
