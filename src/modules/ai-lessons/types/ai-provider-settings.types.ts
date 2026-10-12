import { LessonLlmProvider } from '../providers/lesson-llm.types';

export interface InternalOpenAiSettings {
  generalModel: string;
  imageModel: string;
  imageQuality: string;
  reasoningEffort: string;
  apiKey: string;
}

export interface InternalGeminiSettings {
  generalModel: string;
  fallbackModel: string;
  imageModel: string;
  imageSize: string;
  maxRetries: number;
  retryBaseDelayMs: number;
  apiKey: string;
}

export interface InternalAiProviderSettings {
  llmProvider: LessonLlmProvider;
  openai: InternalOpenAiSettings;
  gemini: InternalGeminiSettings;
}
