export enum AiQueueFeature {
  LESSONS = 'lessons',
  SHARED_IDEAS = 'shared_ideas',
  PROVIDER_SETTINGS = 'provider_settings',
}
export enum AiQueueProviderName {
  OPENAI = 'openai',
  GEMINI = 'gemini',
}
export enum AiQueueMethod {
  POST = 'POST',
  GET = 'GET',
}
export enum AiQueueBodyKind {
  JSON = 'json',
  MULTIPART = 'multipart',
}
export enum AiQueueFailure {
  UNAVAILABLE = 'AI_QUEUE_UNAVAILABLE',
  EXPIRED = 'AI_QUEUE_EXPIRED',
  CANCELLED = 'AI_QUEUE_CANCELLED',
  INVALID_REQUEST = 'AI_QUEUE_INVALID_REQUEST',
  RESULT_EXPIRED = 'AI_QUEUE_RESULT_EXPIRED',
  /** The process that enqueued the job is gone: nobody would consume a paid result. */
  ORPHANED = 'AI_QUEUE_ORPHANED',
  /** The selected provider has no readable API key. */
  CREDENTIAL_MISSING = 'AI_QUEUE_CREDENTIAL_MISSING',
}

/**
 * Modo do transporte de IA. `fake` nunca chama o provedor: devolve respostas
 * determinísticas no formato esperado (testes E2E e desenvolvimento sem gastar
 * tokens). Ignorado em produção.
 */
export enum AiProviderMode {
  LIVE = 'live',
  FAKE = 'fake',
}

/**
 * Falhas que o modo `fake` encena quando o pedido traz o marcador
 * `[[ai-fake:<cenário>]]` nos dados de origem.
 */
export enum AiFakeScenario {
  RATE_LIMIT = 'rate-limit',
  QUOTA = 'quota',
  AUTH = 'auth',
  SERVER_ERROR = 'server-error',
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  BLOCKED = 'blocked',
  INVALID_JSON = 'invalid-json',
  /** Resposta cortada pelo limite de tokens. */
  TRUNCATED = 'truncated',
  /**
   * Revisão fiel (maiúscula inicial, espaços e ponto final), sem conteúdo novo:
   * é a melhoria que as guardas têm de aprovar e a tela tem de destacar.
   */
  POLISH = 'polish',
  /** Troca o texto inteiro: é o que as guardas de essência têm de reprovar. */
  REWRITE = 'rewrite',
  /** Demora antes de responder, para observar progresso e cancelamento. */
  SLOW = 'slow',
}
