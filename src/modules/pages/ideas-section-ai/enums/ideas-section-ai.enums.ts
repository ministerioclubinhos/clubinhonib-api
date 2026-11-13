export enum IdeaAiEnhancementStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum IdeaAiMediaStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  ENHANCED = 'ENHANCED',
  SKIPPED = 'SKIPPED',
  REJECTED_BY_GUARD = 'REJECTED_BY_GUARD',
  FAILED = 'FAILED',
}

export enum IdeaAiDecision {
  PENDING = 'PENDING',
  ENHANCED = 'ENHANCED',
  ORIGINAL = 'ORIGINAL',
}

export enum IdeaAiSkipReason {
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  ESSENTIAL_VISUALS = 'ESSENTIAL_VISUALS',
  TOO_LARGE = 'TOO_LARGE',
  ALREADY_GOOD = 'ALREADY_GOOD',
  CONTAINS_PEOPLE = 'CONTAINS_PEOPLE',
  LIMIT_REACHED = 'LIMIT_REACHED',
}

export enum IdeaAiMediaKind {
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  IMAGE = 'IMAGE',
}

export enum IdeaSubmissionSnapshotSource {
  SUBMISSION = 'SUBMISSION',
  LEGACY_CAPTURE = 'LEGACY_CAPTURE',
}

export enum IdeaAiPublicationField {
  TITLE = 'TITLE',
  DESCRIPTION = 'DESCRIPTION',
  MEDIA = 'MEDIA',
}

export enum IdeaAiErrorCode {
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
  PROVIDER_REQUEST_FAILED = 'PROVIDER_REQUEST_FAILED',
  INVALID_PROVIDER_RESPONSE = 'INVALID_PROVIDER_RESPONSE',
  GUARD_REJECTED = 'GUARD_REJECTED',
  LIMIT_REACHED = 'LIMIT_REACHED',
  CANCELLED = 'CANCELLED',
  /** O processamento derrubou o worker repetidas vezes; não é reivindicado de novo. */
  STALLED = 'STALLED',
  /** A ideia ficou sem o snapshot do envio original. */
  SNAPSHOT_MISSING = 'SNAPSHOT_MISSING',
  /** A fila compartilhada de IA estava indisponível. */
  QUEUE_UNAVAILABLE = 'QUEUE_UNAVAILABLE',
}

/** O que uma tentativa refaz. */
export enum IdeaAiScope {
  /** Texto e todas as mídias, a partir do original. */
  FULL = 'FULL',
  /** Só título e descrição; as mídias vêm do resultado vigente. */
  TEXT = 'TEXT',
  /** Só as mídias escolhidas; o resto vem do resultado vigente. */
  MEDIA = 'MEDIA',
  /** Só o que falhou ou foi reprovado pela guarda no resultado vigente. */
  FAILED = 'FAILED',
}

/** Filtro da fila da administração pelo estado da IA. */
export enum IdeaAiQueueFilter {
  /** Há resultado para revisar e nada em andamento. */
  READY = 'READY',
  /** Na fila ou processando. */
  PROCESSING = 'PROCESSING',
  /** A última tentativa falhou ou travou. */
  FAILED = 'FAILED',
  /** Nenhuma tentativa até agora. */
  NONE = 'NONE',
}
