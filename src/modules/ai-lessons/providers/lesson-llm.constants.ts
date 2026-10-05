export const LESSON_LLM_PROVIDER = Symbol('LESSON_LLM_PROVIDER');

export const GEMINI_API_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta';

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
