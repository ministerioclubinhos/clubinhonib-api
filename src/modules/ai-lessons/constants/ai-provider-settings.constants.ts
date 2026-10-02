export enum AiProviderSettingsKey {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  ACTIVE = 'active',
}

export const AI_PROVIDER_MAX_RETRIES = 10;
export const AI_PROVIDER_MAX_RETRY_DELAY_MS = 10000;
export const DEFAULT_OPENAI_GENERAL_MODELS = [
  'gpt-6-luna',
  'gpt-5.6-luna',
  'gpt-5.6',
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'o1',
];
export const DEFAULT_OPENAI_IMAGE_MODELS = [
  'gpt-image-2',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
  'gpt-image-1-mini',
  'dall-e-3',
];
export const DEFAULT_GEMINI_GENERAL_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];
export const DEFAULT_GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image',
  'imagen-3.0-generate-002',
];

export const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-6-luna';
export const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2';
export const DEFAULT_OPENAI_IMAGE_QUALITY = 'high';
export const DEFAULT_OPENAI_REASONING_EFFORT = 'none';
