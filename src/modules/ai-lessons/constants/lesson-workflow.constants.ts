import {
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
} from '../enums/lesson.enums';

/** Background generation: lease, heartbeat and resume policy. */
export const LESSON_GENERATION = {
  RESUME_INTERVAL_MS: 5000,
  HEARTBEAT_INTERVAL_MS: 10_000,
  LEASE_SECONDS: 30,
  /** Attempts (first run + resumes) allowed before the stage fails for good. */
  MAX_ATTEMPTS: 3,
  DEFAULT_MAX_CONCURRENT: 3,
  MAX_CONCURRENT_CONFIG_KEY: 'AI_LESSONS_MAX_CONCURRENT_GENERATIONS',
} as const;

/** Weekly-material publication: lease, heartbeat and public failure text. */
export const LESSON_PUBLICATION = {
  LEASE_SECONDS: 60,
  HEARTBEAT_INTERVAL_MS: 20_000,
  RECONCILE_INTERVAL_MS: 5000,
  FAILURE_MESSAGE_MAX_LENGTH: 500,
  GENERIC_FAILURE_MESSAGE:
    'Não foi possível publicar o material semanal. Nenhum material foi criado; tente novamente.',
  INTERRUPTED_MESSAGE:
    'A publicação anterior foi interrompida antes da criação do material semanal. Você pode publicar novamente.',
  ORIGIN_MARKER_PREFIX: '[origem:licao:',
  ORIGIN_MARKER_SEARCH_LIMIT: 5,
} as const;

/** Server-sent events stream of a lesson. */
export const LESSON_EVENT_STREAM = {
  TICK_MS: 2000,
  MAX_TICKS_PER_CONNECTION: 90,
  MAX_CONNECTIONS_PER_USER_AND_LESSON: 4,
} as const;

export const LESSON_STAGE_FAILURE_MESSAGE_MAX_LENGTH = 500;

export const LESSON_VISUAL_QUANTITY = { MIN: 4, MAX: 10 } as const;

export const LESSON_CANONICAL_VERSE_VERSION = 'NVI';

/** Generated artwork accepted for upload. */
export const LESSON_GENERATED_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

/** Parallel S3 deletions while cleaning up assets. */
export const LESSON_ASSET_CLEANUP_CONCURRENCY = 4;

export const LESSON_ASSET_LIST_KEYS = ['assets', 'printableAssets'] as const;

export const LESSON_PRINTABLE_ASSET_STAGES: readonly LessonStageType[] = [
  LessonStageType.VERSE_VISUALS,
  LessonStageType.MEDITATION_YOUNGER,
  LessonStageType.MEDITATION_OLDER,
  LessonStageType.MANUAL_WORK,
];

export const LESSON_IDENTITY_REFERENCE_STAGES: readonly LessonStageType[] = [
  LessonStageType.LESSON_VISUALS,
  LessonStageType.STANDARD_GAME,
  LessonStageType.VERSE_FIXATION,
];

export const LESSON_GAME_STAGES: readonly LessonStageType[] = [
  LessonStageType.STANDARD_GAME,
  LessonStageType.VERSE_FIXATION,
];

export const LESSON_MEDITATION_STAGES: readonly LessonStageType[] = [
  LessonStageType.MEDITATION_YOUNGER,
  LessonStageType.MEDITATION_OLDER,
];

export const LESSON_DERIVED_VERSE_STAGES: readonly LessonStageType[] = [
  LessonStageType.VERSE_VISUALS,
  LessonStageType.VERSE_FIXATION,
  LessonStageType.MEDITATION_YOUNGER,
  LessonStageType.MEDITATION_OLDER,
  LessonStageType.MANUAL_WORK,
];

/** Stage statuses the producer may still edit or conclude. */
export const LESSON_STAGE_EDITABLE_STATUSES: readonly LessonStageStatus[] = [
  LessonStageStatus.DRAFT,
  LessonStageStatus.PRODUCER_APPROVED,
  LessonStageStatus.CHANGES_REQUESTED,
  LessonStageStatus.STALE,
  LessonStageStatus.FAILED,
];

/** Stage statuses that count as concluded by the producer. */
export const LESSON_STAGE_COMPLETED_STATUSES: readonly LessonStageStatus[] = [
  LessonStageStatus.PRODUCER_APPROVED,
  LessonStageStatus.IN_REVIEW,
  LessonStageStatus.APPROVED,
];

/** Stage statuses whose conclusion needs a fresh look at the upstream content. */
export const LESSON_STAGE_OUTDATED_STATUSES: readonly LessonStageStatus[] = [
  LessonStageStatus.STALE,
  LessonStageStatus.FAILED,
];

/** Lesson statuses in which no stage may be (re)generated. */
export const LESSON_GENERATION_BLOCKED_STATUSES: readonly LessonStatus[] = [
  LessonStatus.IN_REVIEW,
  LessonStatus.READY_FOR_PUBLICATION,
  LessonStatus.PUBLISHING,
  LessonStatus.PUBLISHED,
  LessonStatus.ARCHIVED,
];

/** Lesson statuses in which the reviewer may approve or return items. */
export const LESSON_REVIEW_STATUSES: readonly LessonStatus[] = [
  LessonStatus.IN_REVIEW,
  LessonStatus.CHANGES_REQUESTED,
];

/** Lesson statuses that are never recomputed from the stages. */
export const LESSON_TERMINAL_STATUSES: readonly LessonStatus[] = [
  LessonStatus.PUBLISHING,
  LessonStatus.PUBLISHED,
  LessonStatus.ARCHIVED,
];

export const LESSON_STAGE_ITEM_NAMES: Record<LessonStageType, string> = {
  [LessonStageType.LESSON]: 'Lição completa',
  [LessonStageType.LESSON_VISUALS]: 'Visuais da história',
  [LessonStageType.STANDARD_GAME]: 'Brincadeira',
  [LessonStageType.VERSE_VISUALS]: 'Visuais do versículo',
  [LessonStageType.VERSE_FIXATION]: 'Fixação divertida do versículo',
  [LessonStageType.MEDITATION_YOUNGER]: 'Meditação dos menores',
  [LessonStageType.MEDITATION_OLDER]: 'Meditação dos maiores',
  [LessonStageType.MANUAL_WORK]: 'Trabalho manual',
};

export const LESSON_GAME_RETRY_INSTRUCTION =
  'A tentativa anterior ficou parecida com a brincadeira existente. Gere uma alternativa radicalmente diferente agora, trocando nome, mecânica principal, materiais característicos, organização e sequência de ações.';

/** Request body limits of the studio endpoints. */
export const LESSON_CONTENT_LIMITS = {
  MAX_TIPTAP_AST_BYTES: 1_500_000,
  MAX_TIPTAP_AST_DEPTH: 32,
  MAX_STRUCTURED_DATA_BYTES: 1_500_000,
  MAX_STRUCTURED_DATA_DEPTH: 32,
  /** Covers the AST plus the structured data and the JSON envelope. */
  JSON_BODY_LIMIT_BYTES: 4 * 1024 * 1024,
} as const;

/** Technical bound: keeps the value inside the integer column. */
export const LESSON_WEEK_NUMBER = { MIN: 1, MAX: 999 } as const;

export const LESSON_REVIEW_NOTE_MAX_LENGTH = 1000;

/** `lesson_versions.changeSummary` column length. */
export const LESSON_CHANGE_SUMMARY_MAX_LENGTH = 255;
