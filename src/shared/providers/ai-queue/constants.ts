export const AI_QUEUE = {
  name: 'llm-requests',
  prefix: 'clubinho',
  jobName: 'provider-request',
  redisUrl: 'redis://127.0.0.1:6379/0',
  concurrency: 1,
  maxConcurrency: 20,
  waitMs: 15 * 60_000,
  maxWaitMs: 24 * 60 * 60_000,
  defaultRequestMs: 180_000,
  maxRequestMs: 180_000,
  connectionMs: 5_000,
  lockMs: 210_000,
  stalledIntervalMs: 30_000,
  resultTtlMs: 300_000,
  terminalGraceMs: 10_000,
  cleanupIntervalMs: 60_000,
  retainedJobCount: 1000,
  maxPayloadBytes: 96 * 1024 * 1024,
  maxResponseBytes: 96 * 1024 * 1024,
  maxEventStreamLength: 1000,
  /** Worker-side Redis commands carry image payloads: allow far more than a ping. */
  workerCommandMs: 60_000,
  /** Result persistence is retried alone; the provider is never called again. */
  resultWriteAttempts: 4,
  resultWriteBackoffMs: 500,
  /** A producer refreshes its liveness key; jobs of dead producers are dropped. */
  producerTtlMs: 30_000,
  producerHeartbeatMs: 10_000,
  /** How long a request waits for Redis to come back before failing. */
  reconnectWaitMs: 5_000,
  reconnectPollMs: 250,
  /** Delay between attempts to bring the queue up when Redis is down. */
  startRetryMs: 10_000,
  /** BullMQ serves lower numbers first; unprioritized jobs would jump ahead. */
  defaultPriority: 10,
  interactivePriority: 1,
  logValueLength: 120,
} as const;
export const AI_QUEUE_SAFE_HEADERS = [
  'retry-after',
  'x-ratelimit-reset-tokens',
  'x-ratelimit-reset-requests',
  'x-request-id',
] as const;
/**
 * Provider error identifiers that may leave the worker. Kept aligned with the
 * codes the Studio classifies for administrators; anything else is dropped.
 */
export const AI_QUEUE_PROVIDER_ERROR_CODES = [
  // OpenAI `error.code` / `error.type`
  'billing_not_active',
  'credit_balance_exhausted',
  'insufficient_quota',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'rate_limit_exceeded',
  'slow_down',
  'invalid_api_key',
  'authentication_error',
  'permission_denied',
  'model_not_found',
  'not_found',
  'content_policy_violation',
  'moderation_blocked',
  'invalid_request_error',
  'invalid_request',
  'parameter_unknown',
  'server_is_overloaded',
  'service_unavailable',
  'api_error',
  'server_error',
  // Gemini canonical `error.status`
  'RESOURCE_EXHAUSTED',
  'UNAUTHENTICATED',
  'PERMISSION_DENIED',
  'INVALID_ARGUMENT',
  'FAILED_PRECONDITION',
  'OUT_OF_RANGE',
  'NOT_FOUND',
  'DEADLINE_EXCEEDED',
  'UNAVAILABLE',
  'INTERNAL',
] as const;
export const AI_QUEUE_NETWORK_CODES = [
  'ECONNRESET',
  'EPIPE',
  'EAI_AGAIN',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ERR_CANCELED',
  'ENOTFOUND',
  'ECONNREFUSED',
] as const;
export const LOCAL_REDIS = {
  container: 'clubinho-redis-local',
  volume: 'clubinho-redis-data',
  image: 'redis:7-alpine',
  readyAttempts: 30,
  retryMs: 1000,
  pingMs: 1000,
} as const;
