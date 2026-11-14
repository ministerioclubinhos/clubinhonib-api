import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiProviderSettingRepository } from '../repositories/ai-provider-setting.repository';
import {
  AI_PROVIDER_MAX_RETRIES,
  AI_PROVIDER_MAX_RETRY_DELAY_MS,
  AI_PROVIDER_SECRET,
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
  ProviderSecretError,
  providerSecretKeysFromEnv,
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
export class GetAiProviderSettingsService implements OnModuleInit {
  private readonly logger = new Logger(GetAiProviderSettingsService.name);

  constructor(private readonly repo: AiProviderSettingRepository) {}

  onModuleInit(): void {
    if (!providerSecretKeysFromEnv().current)
      this.logger.warn(
        `${AI_PROVIDER_SECRET.currentKeyEnv} ausente: as chaves dos provedores de IA não são criptografadas em repouso.`,
      );
  }

  /** Pure mapping of a stored row to runtime settings; also used under a write lock. */
  openAiFromStored(
    saved: Record<string, unknown> | null | undefined,
  ): InternalOpenAiSettings {
    const read = (key: string, fallback: string): string =>
      providerSettingString(saved?.[key], fallback);
    return {
      generalModel: read('generalModel', DEFAULT_OPENAI_TEXT_MODEL),
      imageModel: read('imageModel', DEFAULT_OPENAI_IMAGE_MODEL),
      imageQuality: read('imageQuality', DEFAULT_OPENAI_IMAGE_QUALITY),
      reasoningEffort: read('reasoningEffort', DEFAULT_OPENAI_REASONING_EFFORT),
      ...this.readApiKey(AiProviderSettingsKey.OPENAI, saved?.apiKey),
    };
  }

  geminiFromStored(
    saved: Record<string, unknown> | null | undefined,
  ): InternalGeminiSettings {
    const read = (key: string, fallback: string): string =>
      providerSettingString(saved?.[key], fallback);
    return {
      generalModel: read('generalModel', DEFAULT_GEMINI_TEXT_MODEL),
      fallbackModel: read('fallbackModel', DEFAULT_GEMINI_TEXT_FALLBACK_MODEL),
      imageModel: read('imageModel', DEFAULT_GEMINI_IMAGE_MODEL),
      imageSize: read('imageSize', DEFAULT_GEMINI_IMAGE_SIZE),
      // Values saved under an older, higher ceiling are clamped on read.
      maxRetries: Math.min(
        providerSettingInteger(saved?.maxRetries, DEFAULT_GEMINI_MAX_RETRIES),
        AI_PROVIDER_MAX_RETRIES,
      ),
      retryBaseDelayMs: Math.min(
        providerSettingInteger(
          saved?.retryBaseDelayMs,
          DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
        ),
        AI_PROVIDER_MAX_RETRY_DELAY_MS,
      ),
      ...this.readApiKey(AiProviderSettingsKey.GEMINI, saved?.apiKey),
    };
  }

  async getInternalOpenAiSettings(): Promise<InternalOpenAiSettings> {
    return this.openAiFromStored(
      await this.repo.findByProvider(AiProviderSettingsKey.OPENAI),
    );
  }

  async getInternalGeminiSettings(): Promise<InternalGeminiSettings> {
    return this.geminiFromStored(
      await this.repo.findByProvider(AiProviderSettingsKey.GEMINI),
    );
  }

  /** Never returns '' silently for an unreadable secret: it is flagged and logged. */
  private readApiKey(
    provider: AiProviderSettingsKey,
    stored: unknown,
  ): { apiKey: string; apiKeyUnreadable?: boolean } {
    try {
      return { apiKey: decryptProviderSecret(stored, provider) };
    } catch (error: unknown) {
      const reason =
        error instanceof ProviderSecretError ? error.reason : 'UNKNOWN';
      this.logger.error(
        `Chave de API do provedor ${provider} armazenada, mas ilegível (${reason}). Verifique ${AI_PROVIDER_SECRET.currentKeyEnv}/${AI_PROVIDER_SECRET.previousKeyEnv}; o valor salvo foi preservado.`,
      );
      return { apiKey: '', apiKeyUnreadable: true };
    }
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
      ...(internal.apiKeyUnreadable ? { apiKeyUnreadable: true } : {}),
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
      ...(internal.apiKeyUnreadable ? { apiKeyUnreadable: true } : {}),
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
