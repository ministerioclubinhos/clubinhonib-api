import { Injectable } from '@nestjs/common';
import { AiProviderSettingRepository } from '../repositories/ai-provider-setting.repository';
import {
  AiProviderSettingsKey,
  DEFAULT_OPENAI_TEXT_MODEL,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_IMAGE_QUALITY,
  DEFAULT_OPENAI_REASONING_EFFORT,
} from '../constants/ai-provider-settings.constants';
import {
  AiProviderSettingsResponseDto,
  GeminiSettingsResponseDto,
  OpenAiSettingsResponseDto,
} from '../dto/ai-provider-settings-response.dto';
import {
  parseLessonProvider,
  providerSettingInteger,
  providerSettingString,
} from '../aiProviderSettings.utils';
import { LessonLlmProvider } from '../providers/lesson-llm.types';
import {
  DEFAULT_GEMINI_MAX_RETRIES,
  DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_GEMINI_TEXT_FALLBACK_MODEL,
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_IMAGE_SIZE,
} from '../providers/lesson-llm.constants';

@Injectable()
export class GetAiProviderSettingsService {
  constructor(private readonly repo: AiProviderSettingRepository) {}

  async getOpenAiSettings(): Promise<OpenAiSettingsResponseDto> {
    const saved = await this.repo.findByProvider(AiProviderSettingsKey.OPENAI);
    const read = (key: string, fallback: string): string =>
      providerSettingString(saved?.[key], fallback);
    return {
      generalModel: read('generalModel', DEFAULT_OPENAI_TEXT_MODEL),
      imageModel: read('imageModel', DEFAULT_OPENAI_IMAGE_MODEL),
      imageQuality: read('imageQuality', DEFAULT_OPENAI_IMAGE_QUALITY),
      reasoningEffort: read('reasoningEffort', DEFAULT_OPENAI_REASONING_EFFORT),
      apiKey: read('apiKey', ''),
    };
  }

  async getGeminiSettings(): Promise<GeminiSettingsResponseDto> {
    const saved = await this.repo.findByProvider(AiProviderSettingsKey.GEMINI);
    const read = (key: string, fallback: string): string =>
      providerSettingString(saved?.[key], fallback);
    return {
      generalModel: read('generalModel', DEFAULT_GEMINI_TEXT_MODEL),
      fallbackModel: read('fallbackModel', DEFAULT_GEMINI_TEXT_FALLBACK_MODEL),
      imageModel: read('imageModel', DEFAULT_GEMINI_IMAGE_MODEL),
      imageSize: read('imageSize', DEFAULT_GEMINI_IMAGE_SIZE),
      maxRetries: providerSettingInteger(
        saved?.maxRetries,
        DEFAULT_GEMINI_MAX_RETRIES,
      ),
      retryBaseDelayMs: providerSettingInteger(
        saved?.retryBaseDelayMs,
        DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
      ),
      apiKey: read('apiKey', ''),
    };
  }

  async getActiveProvider(): Promise<LessonLlmProvider> {
    const saved = await this.repo.findByProvider(AiProviderSettingsKey.ACTIVE);
    return parseLessonProvider(saved?.llmProvider ?? LessonLlmProvider.OPENAI);
  }

  async getSettings(): Promise<AiProviderSettingsResponseDto> {
    const [llmProvider, openai, gemini] = await Promise.all([
      this.getActiveProvider(),
      this.getOpenAiSettings(),
      this.getGeminiSettings(),
    ]);
    return { llmProvider, openai, gemini };
  }
}
