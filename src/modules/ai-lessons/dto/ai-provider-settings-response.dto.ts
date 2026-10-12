import { LessonLlmProvider } from '../providers/lesson-llm.types';

export class OpenAiSettingsResponseDto {
  generalModel: string;
  imageModel: string;
  imageQuality: string;
  reasoningEffort: string;
  hasApiKey: boolean;
}

export class GeminiSettingsResponseDto {
  generalModel: string;
  fallbackModel: string;
  imageModel: string;
  imageSize: string;
  maxRetries: number;
  retryBaseDelayMs: number;
  hasApiKey: boolean;
}

export class AiProviderSettingsResponseDto {
  llmProvider: LessonLlmProvider;
  openai: OpenAiSettingsResponseDto;
  gemini: GeminiSettingsResponseDto;
}

export class AiProviderModelsResponseDto {
  models: { general: string[]; image: string[] };
}

export interface OpenAiModelListResponse {
  data: Array<{ id: string; created?: number }>;
}
