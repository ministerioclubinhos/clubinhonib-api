export enum AiProviderSettingsKey {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  ACTIVE = 'active',
}

export enum AiModelCatalogSource {
  LIVE = 'LIVE',
  FALLBACK = 'FALLBACK',
  STATIC = 'STATIC',
}

export enum AiProviderSecretFailure {
  MASTER_KEY_MISSING = 'MASTER_KEY_MISSING',
  UNKNOWN_KEY_ID = 'UNKNOWN_KEY_ID',
  MALFORMED = 'MALFORMED',
  DECRYPT_FAILED = 'DECRYPT_FAILED',
}

export const AI_PROVIDER_SECRET = {
  prefixV1: 'enc:v1:',
  prefixV2: 'enc:v2:',
  currentKeyEnv: 'AI_PROVIDER_SETTINGS_ENCRYPTION_KEY',
  previousKeyEnv: 'AI_PROVIDER_SETTINGS_ENCRYPTION_KEY_PREVIOUS',
  hkdfInfo: 'clubinho-ai-provider-settings:v2',
  keyIdContext: 'clubinho-ai-provider-settings:kid:',
  keyIdLength: 8,
  productionEnvironments: ['prod', 'production'],
} as const;

export enum OpenAiImageQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  AUTO = 'auto',
}

export enum OpenAiReasoningEffort {
  NONE = 'none',
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  XHIGH = 'xhigh',
}

export enum GeminiImageSize {
  ONE_K = '1K',
  TWO_K = '2K',
  FOUR_K = '4K',
}

/** Paid calls multiply by retries: keep the ceiling low. */
export const AI_PROVIDER_MAX_RETRIES = 5;
export const AI_PROVIDER_MAX_RETRY_DELAY_MS = 10000;
/** Upper bound for a single backoff sleep, whatever the saved base delay. */
export const AI_PROVIDER_RETRY_DELAY_CAP_MS = 60_000;
export const AI_PROVIDER_MAX_MODEL_LENGTH = 120;
export const AI_PROVIDER_MAX_OPTION_LENGTH = 40;
export const AI_PROVIDER_MAX_API_KEY_LENGTH = 512;
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
];
export const DEFAULT_GEMINI_GENERAL_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];
/** Imagen is not offered: the Studio drives images through the Interactions API. */
export const DEFAULT_GEMINI_IMAGE_MODELS = ['gemini-3.1-flash-image'];

export const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-6-luna';
export const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2';
export const DEFAULT_OPENAI_IMAGE_QUALITY = 'high';
export const DEFAULT_OPENAI_REASONING_EFFORT = 'none';

/** One paid image per game step: bounded by schema and by local validation. */
export const LESSON_GAME_MAX_STEPS = 8;

/**
 * Live catalog filter. Only families the Studio can drive are offered:
 * structured text through the Responses API and base64 PNG images (DALL·E
 * rejects the size/quality/output_format/edit parameters the Studio sends).
 */
export const AI_MODEL_CATALOG = {
  requestMs: 5000,
  queueWaitMs: 10_000,
  imagePrefixes: ['gpt-image-'],
  generalPrefixes: ['gpt-', 'o1', 'o3', 'o4'],
  excludedFragments: [
    'realtime',
    'transcribe',
    'tts',
    'whisper',
    'embedding',
    'audio',
    'search',
    'instruct',
    'dall-e',
  ],
  geminiPrefix: 'gemini-',
  geminiNamePrefix: 'models/',
  geminiTextMethod: 'generateContent',
  geminiImageFragment: 'image',
  geminiExcludedFragments: [
    'embedding',
    'tts',
    'audio',
    'live',
    'robotics',
    'computer-use',
    'aqa',
  ],
  /** Statuses that mean the provider answered and refused the saved key. */
  openAiRejectedKeyStatuses: [401],
  geminiRejectedKeyStatuses: [400, 401, 403],
  forbiddenStatus: 403,
} as const;

export const AI_MODEL_CATALOG_WARNING = {
  missingKey: (provider: string): string =>
    `Nenhuma chave de ${provider} salva; exibindo a lista padrão de contingência.`,
  unreadableKey: (provider: string): string =>
    `A chave de ${provider} salva não pôde ser lida pelo servidor. Digite a chave novamente e salve; exibindo a lista padrão de contingência.`,
  rejectedKey: (provider: string): string =>
    `${provider} recusou a chave salva. Confira a chave e salve novamente; exibindo a lista padrão de contingência.`,
  forbidden: (provider: string): string =>
    `A chave de ${provider} salva não tem permissão para listar modelos; exibindo a lista padrão de contingência.`,
  unavailable: (provider: string): string =>
    `Não foi possível consultar o catálogo de ${provider} agora; exibindo a lista padrão de contingência.`,
  empty: (provider: string): string =>
    `${provider} não retornou modelos compatíveis com o Estúdio; exibindo a lista padrão de contingência.`,
} as const;
