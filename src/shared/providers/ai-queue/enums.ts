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
