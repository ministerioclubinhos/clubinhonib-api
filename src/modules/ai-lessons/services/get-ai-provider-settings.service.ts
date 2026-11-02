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
  decryptProviderSecret,
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

import {
  InternalAiProviderSettings,
  InternalGeminiSettings,
  InternalOpenAiSettings,
} from '../types/ai-provider-settings.types';

@Injectable()
export class GetAiProviderSettingsService {
  constructor(private readonly repo: AiProviderSettingRepository) {}

  async getInternalOpenAiSettings(): Promise<InternalOpenAiSettings> {
    const saved = await this.repo.findByProvider(AiProviderSettingsKey.OPENAI);
    const read = (key: string, fallback: string): string =>
      providerSettingString(saved?.[key], fallback);
    return {
      generalModel: read('generalModel', DEFAULT_OPENAI_TEXT_MODEL),
      imageModel: read('imageModel', DEFAULT_OPENAI_IMAGE_MODEL),
      imageQuality: read('imageQuality', DEFAULT_OPENAI_IMAGE_QUALITY),
      reasoningEffort: read('reasoningEffort', DEFAULT_OPENAI_REASONING_EFFORT),
      apiKey: decryptProviderSecret(saved?.apiKey),
    };
  }

  async getInternalGeminiSettings(): Promise<InternalGeminiSettings> {
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
      apiKey: decryptProviderSecret(saved?.apiKey),
    };
  }

  async getInternalSettings(): Promise<InternalAiProviderSettings> {
    const [llmProvider, openai, gemini] = await Promise.all([
      this.getActiveProvider(),
      this.getInternalOpenAiSettings(),
      this.getInternalGeminiSettings(),
    ]);
    return { llmProvider, openai, gemini };
  }

  async getOpenAiSettings(): Promise<OpenAiSettingsResponseDto> {
    const internal = await this.getInternalOpenAiSettings();
    return {
      generalModel: internal.generalModel,
      imageModel: internal.imageModel,
      imageQuality: internal.imageQuality,
      reasoningEffort: internal.reasoningEffort,
      hasApiKey: Boolean(internal.apiKey && internal.apiKey.trim().length > 0),
    };
  }

  async getGeminiSettings(): Promise<GeminiSettingsResponseDto> {
    const internal = await this.getInternalGeminiSettings();
    return {
      generalModel: internal.generalModel,
      fallbackModel: internal.fallbackModel,
      imageModel: internal.imageModel,
      imageSize: internal.imageSize,
      maxRetries: internal.maxRetries,
      retryBaseDelayMs: internal.retryBaseDelayMs,
      hasApiKey: Boolean(internal.apiKey && internal.apiKey.trim().length > 0),
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
