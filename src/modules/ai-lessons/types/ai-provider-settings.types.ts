import { LessonLlmProvider } from '../providers/lesson-llm.types';
import { AiProviderSettingsKey } from '../constants/ai-provider-settings.constants';

export interface InternalOpenAiSettings {
  generalModel: string;
  imageModel: string;
  imageQuality: string;
  reasoningEffort: string;
  apiKey: string;
  /** A secret is stored but could not be read with the configured keys. */
  apiKeyUnreadable?: boolean;
}

export interface InternalGeminiSettings {
  generalModel: string;
  fallbackModel: string;
  imageModel: string;
  imageSize: string;
  maxRetries: number;
  retryBaseDelayMs: number;
  apiKey: string;
  /** A secret is stored but could not be read with the configured keys. */
  apiKeyUnreadable?: boolean;
}

export interface InternalAiProviderSettings {
  llmProvider: LessonLlmProvider;
  openai: InternalOpenAiSettings;
  gemini: InternalGeminiSettings;
}

export interface ProviderSecretKeys {
  current: string;
  previous: string;
}

export type StoredAiProviderSettings = Partial<
  Record<AiProviderSettingsKey, Record<string, unknown>>
>;

export type StoredAiProviderSettingsMerge = (
  current: StoredAiProviderSettings,
) => StoredAiProviderSettings;
