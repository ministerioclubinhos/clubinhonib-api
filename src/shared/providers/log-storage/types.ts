import { UserRole } from 'src/core/auth/auth.types';

import {
  LogActorType,
  LogRecordType,
  LogSourceType,
  LogStorageKind,
  LogStream,
} from './enums';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Campos comuns a todo item técnico ou de auditoria. */
export interface LogRecordBase {
  schemaVersion: string;
  eventId: string;
  recordType: LogRecordType;
  environment: string;
  service: string;
  /** ISO-8601 em UTC. */
  occurredAt: string;
  expiresAtEpochSeconds: number;
  requestId: string | null;
  sourceType: LogSourceType;
  actorType: LogActorType;
  actorId: string | null;
  actorRole: UserRole | null;
}

/**
 * Um item pronto para persistir.
 *
 * Os fluxos concretos (observabilidade e auditoria) estendem a base com os
 * seus campos; o storage só exige que tudo seja JSON serializável.
 */
export interface LogRecord extends LogRecordBase {
  [field: string]: JsonValue | undefined;
}

export interface FileStorageConfig {
  kind: LogStorageKind.File;
  /** Caminho absoluto já resolvido e validado. */
  directory: string;
}

export interface DynamoDbStorageConfig {
  kind: LogStorageKind.DynamoDb;
  tableName: string;
  region: string;
  /** Somente para DynamoDB Local em desenvolvimento. */
  endpoint: string | null;
}

export type StreamStorageConfig = FileStorageConfig | DynamoDbStorageConfig;

export interface StreamConfig {
  stream: LogStream;
  storage: StreamStorageConfig;
  ttlDays: number;
}

export interface AuditStreamConfig extends StreamConfig {
  dedupSeconds: number;
}

export interface LogStorageConfig {
  environment: string;
  observability: StreamConfig;
  audit: AuditStreamConfig;
}

/** Filtros de igualdade aceitos pela consulta, já allowlisted pelo chamador. */
export type LogRecordFilters = Readonly<Record<string, string>>;

export interface LogRecordQuery {
  recordType: QueryableRecordType;
  from: Date;
  to: Date;
  /** Página a partir de 1. */
  page: number;
  limit: number;
  requestId: string | null;
  filters: LogRecordFilters;
}

/** Fluxo lógico consultável/apagável pela API administrativa. */
export type QueryableRecordType =
  | LogRecordType.Observability
  | LogRecordType.Audit;

/** Um item a apagar, localizado pela chave natural (dia + instante + id). */
export interface LogRecordReference {
  recordType: QueryableRecordType;
  eventId: string;
  occurredAt: string;
}

/** Intervalo a apagar de um fluxo. */
export interface LogRecordRange {
  recordType: QueryableRecordType;
  from: Date;
  to: Date;
}

/** Página por offset, com o total que a tela precisa para numerar páginas. */
export interface LogRecordPage {
  items: LogRecord[];
  total: number;
  page: number;
  limit: number;
}

/** Referência ao primeiro evento de uma janela de desduplicação. */
export interface DedupReference {
  eventId: string;
  occurredAt: string;
}

export interface DedupClaim {
  fingerprint: string;
  /** `null` quando este evento abre a janela; senão, o evento que ela repete. */
  duplicateOf: DedupReference | null;
}

export interface DedupClaimInput {
  fingerprint: string;
  eventId: string;
  occurredAt: string;
  windowSeconds: number;
  /** Quando o marcador pode ser removido pelo TTL. */
  expiresAtEpochSeconds: number;
}

/** Como uma tentativa de escrita terminou, para o retry decidir. */
export enum LogWriteFailureKind {
  Transient = 'transient',
  Permanent = 'permanent',
}

export class LogWriteError extends Error {
  constructor(
    message: string,
    readonly kind: LogWriteFailureKind,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LogWriteError';
  }
}

export interface DeliveryQueueOptions {
  maxQueueSize: number;
  writeTimeoutMs: number;
  maxAttempts: number;
  retryDelayMs: number;
  drainTimeoutMs: number;
}

export interface DeliveryQueueStats {
  enqueued: number;
  written: number;
  dropped: number;
  failed: number;
  pending: number;
}

/** Sinal de emergência: sai por stderr, nunca pelo próprio logger. */
export type EmergencySink = (
  component: string,
  message: string,
  detail?: JsonValue,
) => void;

/** Relógio injetável para os testes controlarem `occurredAt` e TTL. */
export type Clock = () => Date;
