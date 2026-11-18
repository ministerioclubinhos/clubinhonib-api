import { RedisOptions } from 'ioredis';
import {
  AiQueueFeature,
  AiQueueProviderName,
  AiQueueMethod,
  AiQueueBodyKind,
  AiQueueFailure,
} from './enums';
export interface AiQueueRequestOptions {
  feature: AiQueueFeature;
  timeout?: number;
  maxContentLength?: number;
  /** Shorter queue wait for interactive requests; capped by the configured wait. */
  waitMs?: number;
}
export interface AiQueueMultipartPart {
  name: string;
  text?: string;
  filename?: string;
  mimeType?: string;
  base64?: string;
}
export interface AiQueueBody {
  kind: AiQueueBodyKind;
  json?: object;
  parts?: AiQueueMultipartPart[];
}
export interface AiQueueRequest {
  resultStored?: boolean;
  /** Instance that enqueued the job; absent on jobs created before this field. */
  producerId?: string;
  feature: AiQueueFeature;
  provider: AiQueueProviderName;
  method: AiQueueMethod;
  url: string;
  body: AiQueueBody;
  timeoutMs: number;
  expiresAt: number;
  maxContentLength: number;
}
export interface AiQueueResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}
export interface AiQueueProviderError {
  status?: number;
  code?: string;
  providerCode?: string;
  /** Gemini canonical status (e.g. RESOURCE_EXHAUSTED). */
  providerStatus?: string;
  type?: string;
  /** Failure raised by the queue/transport itself, not by the provider. */
  queueFailure?: AiQueueFailure;
  freeTierQuota: boolean;
  headers: Record<string, string>;
}
export interface AiQueueTransportFailure {
  code?: unknown;
  cause?: { code?: unknown };
  response?: { status?: unknown; headers?: unknown; data?: unknown };
}
export type AiQueueResult =
  | { success: true; response: AiQueueResponse }
  | { success: false; error: AiQueueProviderError };
export interface AiQueueCompletion {
  resultKey: string;
}
export interface AiQueueCompletedEvent {
  returnvalue: AiQueueCompletion;
}
export interface AiQueueFailedEvent {
  failedReason: string;
}
export interface AiQueueConfig {
  connection: RedisOptions;
  prefix: string;
  concurrency: number;
  waitMs: number;
}
export interface AiQueueJobLog {
  jobId: string;
  feature: string;
  provider: string;
  path: string;
  outcome: string;
  status?: number;
  providerCode?: string;
  requestId?: string;
  ms: number;
}
export interface AiQueueEndpoint {
  provider: AiQueueProviderName;
  url: string;
}
export interface LocalRedisDependencies {
  ping: (url: string) => Promise<boolean>;
  docker: (args: string[]) => string;
  wait: () => Promise<void>;
  log: (message: string) => void;
}
