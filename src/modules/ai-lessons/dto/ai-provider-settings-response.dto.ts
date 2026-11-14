import { AiModelCatalogSource } from '../constants/ai-provider-settings.constants';
import { LessonLlmProvider } from '../providers/lesson-llm.types';

export class OpenAiSettingsResponseDto {
  generalModel: string;
  imageModel: string;
  imageQuality: string;
  reasoningEffort: string;
  hasApiKey: boolean;
  /** Há uma chave salva, mas a chave mestra atual não consegue lê-la. */
  apiKeyUnreadable?: boolean;
}

export class GeminiSettingsResponseDto {
  generalModel: string;
  fallbackModel: string;
  imageModel: string;
  imageSize: string;
  maxRetries: number;
  retryBaseDelayMs: number;
  hasApiKey: boolean;
  /** Há uma chave salva, mas a chave mestra atual não consegue lê-la. */
  apiKeyUnreadable?: boolean;
}

export class AiProviderSettingsResponseDto {
  llmProvider: LessonLlmProvider;
  openai: OpenAiSettingsResponseDto;
  gemini: GeminiSettingsResponseDto;
}

export class AiProviderModelsResponseDto {
  models: { general: string[]; image: string[] };
  source?: AiModelCatalogSource;
  isLive?: boolean;
  warning?: string | null;
}

export interface OpenAiModelListResponse {
  data: Array<{ id: string; created?: number }>;
}

export interface GeminiModelListResponse {
  models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
}

export interface AiModelCatalogLists {
  general: string[];
  image: string[];
}
