import { LessonStageType } from '../enums/lesson.enums';
export const LESSON_LLM_PROVIDER = Symbol('LESSON_LLM_PROVIDER');

export const GEMINI_API_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta';

/** Single page: the queue allowlist accepts exactly this query. */
export const GEMINI_MODELS_URL = `${GEMINI_API_BASE_URL}/models?pageSize=1000`;

export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_TEXT_FALLBACK_MODEL = 'gemini-2.0-flash';
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const DEFAULT_GEMINI_IMAGE_SIZE = '2K';
export const DEFAULT_GEMINI_MAX_RETRIES = 3;
export const DEFAULT_GEMINI_RETRY_BASE_DELAY_MS = 1000;

export enum GeminiTextFinishReason {
  STOP = 'STOP',
  MAX_TOKENS = 'MAX_TOKENS',
  RECITATION = 'RECITATION',
  SAFETY = 'SAFETY',
}

export const PROVIDER_IMAGE = {
  maxBytes: 15 * 1024 * 1024,
  pngSignature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpegSignature: [0xff, 0xd8, 0xff],
} as const;

export const PROVIDER_REQUEST = {
  textTimeoutMs: 120_000,
  /**
   * Items whose answer is long: the full lesson (1.500–2.000 words plus a
   * self-review) and the story visuals (kit inventory with evidence, or the
   * whole story split in excerpts). 120 s was not enough for either.
   */
  longTextTimeoutMs: 300_000,
  imageTimeoutMs: 180_000,
  retryJitterMs: 250,
} as const;

/** 429/503 mean the request was not processed; other 5xx are ambiguous. */
export const GEMINI_TEXT_RETRY_STATUSES = [429, 500, 502, 503, 504] as const;
export const GEMINI_IMAGE_RETRY_STATUSES = [429, 503] as const;

/** Blocks that another Gemini model would repeat: do not spend the fallback. */
export const GEMINI_NO_FALLBACK_REASONS = [
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'IMAGE_SAFETY',
] as const;

/**
 * Gemini canonical statuses translated to the failure codes the Studio
 * already classifies for the administrator.
 */
export const GEMINI_FAILURE_CODE_ALIASES: Readonly<Record<string, string>> = {
  UNAUTHENTICATED: 'authentication',
  UNAVAILABLE: 'service_unavailable',
  INTERNAL: 'api_error',
  INVALID_ARGUMENT: 'invalid_request',
};

export const PROVIDER_TIMEOUT_NETWORK_CODES = [
  'ECONNABORTED',
  'ETIMEDOUT',
] as const;
export const PROVIDER_TIMEOUT_FAILURE_CODE = 'deadline_exceeded';
/** Characters kept from each end of an unreadable structured answer in the log. */
export const PROVIDER_JSON_DIAGNOSTIC_EDGE = 160;
/** Stages that get `PROVIDER_REQUEST.longTextTimeoutMs`. */
export const LONG_TEXT_STAGES: readonly LessonStageType[] = [
  LessonStageType.LESSON,
  LessonStageType.LESSON_VISUALS,
];

export enum LessonImageOrientation {
  PORTRAIT = 'PORTRAIT',
  LANDSCAPE = 'LANDSCAPE',
}

/**
 * Output ceilings for OpenAI models without reasoning. Reasoning models spend
 * hidden tokens from the same budget, so they keep the provider default.
 */
export const OPENAI_MAX_OUTPUT_TOKENS = {
  lesson: 12_000,
  default: 8_000,
} as const;
export const OPENAI_API = {
  responses: 'https://api.openai.com/v1/responses',
  imageGenerations: 'https://api.openai.com/v1/images/generations',
  imageEdits: 'https://api.openai.com/v1/images/edits',
  models: 'https://api.openai.com/v1/models',
  portraitSize: '1024x1536',
  landscapeSize: '1536x1024',
  imageFormat: 'png',
  refusalBlock: 'refusal',
  textBlock: 'output_text',
} as const;
