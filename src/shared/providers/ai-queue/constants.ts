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
  /** Longest single provider call (the lesson text); the lock stays 30 s above it. */
  maxRequestMs: 300_000,
  connectionMs: 5_000,
  lockMs: 330_000,
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

/** Exact query allowed on the Gemini model list (single page, no key). */
export const AI_QUEUE_GEMINI_MODELS_QUERY = '?pageSize=1000';

/** Variável de ambiente que escolhe o modo do transporte de IA. */
export const AI_PROVIDER_MODE_ENV = 'AI_PROVIDER_MODE';
/** Texto usado nas respostas simuladas quando não há o que ecoar. */
export const AI_FAKE_TEXT = 'Resposta simulada (AI_PROVIDER_MODE=fake).';
/** PNG 1×1 transparente devolvido pelas rotas de imagem no modo simulado. */
export const AI_FAKE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR1sAAAAASUVORK5CYII=';
/** Identificador de resposta simulado: o Estúdio exige um id para encadear versões. */
export const AI_FAKE_RESPONSE_ID = 'resp_fake_ai_provider_mode';
/**
 * Versículo principal simulado: a lição só é aceita com texto, referência
 * bíblica e versão NVI, e o resto do Estúdio parte dele.
 */
export const AI_FAKE_MEMORY_VERSE = {
  text: 'Porque Deus tanto amou o mundo que deu o seu Filho Unigênito, para que todo o que nele crê não pereça, mas tenha a vida eterna.',
  reference: 'João 3:16',
  version: 'NVI',
} as const;
export const AI_FAKE_MODELS = {
  text: 'fake-text-model',
  image: 'fake-image-model',
} as const;
/**
 * Booleanos com valor fixo no modo simulado, escolhidos para o caminho mais
 * conservador: a guarda aprova o que não mudou, fotos são tratadas como tendo
 * pessoas e documentos como tendo visuais essenciais (nada é editado).
 */
export const AI_FAKE_BOOLEANS: Readonly<Record<string, boolean>> = {
  preservesEssence: true,
  containsPeople: true,
  hasEssentialVisuals: true,
};
/** Marcadores dos dados de origem que os pedidos de IA embutem no texto. */
export const AI_SOURCE_DATA_START = 'SOURCE_DATA\n';
export const AI_SOURCE_DATA_END = '\nEND_SOURCE_DATA';

/**
 * `[[ai-fake:rate-limit]]` falha sempre; `[[ai-fake:rate-limit:2#abc]]` falha as
 * duas primeiras chamadas e depois responde. O `#id` isola um teste do outro.
 */
export const AI_FAKE_MARKER =
  /\[\[ai-fake:([a-z-]+)(?::(\d{1,2}))?(?:#([\w-]{1,40}))?\]\]/;
export const AI_FAKE_SLOW_MS = 6_000;
export const AI_FAKE_RETRY_AFTER_SECONDS = '1';
/** Máximo de marcadores com contador em memória. */
export const AI_FAKE_MAX_COUNTERS = 500;
export const AI_FAKE_REWRITE_TEXT =
  'Texto completamente diferente, inventado pela simulação para trocar a ideia original.';
export const AI_FAKE_INVALID_JSON = '{"title": "resposta incompleta"';
/** Erros no formato HTTP de cada provedor. */
export const AI_FAKE_HTTP_FAULTS = {
  'rate-limit': {
    status: 429,
    code: 'rate_limit_exceeded',
    geminiStatus: 'RESOURCE_EXHAUSTED',
  },
  quota: {
    status: 429,
    code: 'insufficient_quota',
    geminiStatus: 'RESOURCE_EXHAUSTED',
  },
  auth: {
    status: 401,
    code: 'invalid_api_key',
    geminiStatus: 'UNAUTHENTICATED',
  },
  'server-error': {
    status: 503,
    code: 'server_is_overloaded',
    geminiStatus: 'UNAVAILABLE',
  },
  blocked: {
    status: 400,
    code: 'content_policy_violation',
    geminiStatus: 'INVALID_ARGUMENT',
  },
} as const;
export const AI_FAKE_NETWORK_FAULTS = {
  timeout: 'ECONNABORTED',
  network: 'ECONNRESET',
} as const;
/** Diário local dos pedidos simulados, relativo à pasta da API (ignorado pelo git). */
export const AI_FAKE_JOURNAL_PATH = '.tmp/ai-fake-journal.jsonl';
export const AI_FAKE_JOURNAL_MAX_BYTES = 10 * 1024 * 1024;
/** Cadeias maiores (anexos em base64) viram só o tamanho no diário. */
export const AI_FAKE_JOURNAL_MAX_STRING = 20_000;
