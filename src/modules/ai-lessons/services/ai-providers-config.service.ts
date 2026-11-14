import { AiRequestQueueService } from 'src/shared/providers/ai-queue/ai-request-queue.service';
import { AiQueueFeature } from 'src/shared/providers/ai-queue/enums';
import { Injectable, Logger } from '@nestjs/common';
import { GetAiProviderSettingsService } from './get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from './update-ai-provider-settings.service';
import {
  AiModelCatalogLists,
  AiProviderModelsResponseDto,
  GeminiModelListResponse,
  OpenAiModelListResponse,
  OpenAiSettingsResponseDto,
  GeminiSettingsResponseDto,
} from '../dto/ai-provider-settings-response.dto';
import {
  GEMINI_MODELS_URL,
  OPENAI_API,
} from '../providers/lesson-llm.constants';
import {
  AI_MODEL_CATALOG,
  AI_MODEL_CATALOG_WARNING,
  AiModelCatalogSource,
  DEFAULT_OPENAI_GENERAL_MODELS,
  DEFAULT_OPENAI_IMAGE_MODELS,
  DEFAULT_GEMINI_GENERAL_MODELS,
  DEFAULT_GEMINI_IMAGE_MODELS,
} from '../constants/ai-provider-settings.constants';
import {
  SaveGeminiSettingsDto,
  SaveOpenAiSettingsDto,
} from '../dto/ai-provider-settings.dto';
import {
  geminiCatalogModels,
  modelCatalogFailureWarning,
  openAiCatalogModels,
} from '../utils/ai-model-catalog.utils';

@Injectable()
export class AiProvidersConfigService {
  private readonly logger = new Logger(AiProvidersConfigService.name);

  constructor(
    private readonly get: GetAiProviderSettingsService,
    private readonly update: UpdateAiProviderSettingsService,
    private readonly queue: AiRequestQueueService,
  ) {}

  /**
   * Live catalog with the saved key. A live answer lists only what the
   * provider returned; any failure falls back to the default list and says why.
   */
  private async catalog<T>(
    provider: string,
    key: { apiKey: string; apiKeyUnreadable?: boolean },
    url: string,
    parse: (response: T | undefined) => AiModelCatalogLists,
    defaults: AiModelCatalogLists,
    rejectedKeyStatuses: readonly number[],
  ): Promise<AiProviderModelsResponseDto> {
    const fallback = (warning: string): AiProviderModelsResponseDto => ({
      models: defaults,
      source: AiModelCatalogSource.FALLBACK,
      isLive: false,
      warning,
    });
    if (key.apiKeyUnreadable)
      return fallback(AI_MODEL_CATALOG_WARNING.unreadableKey(provider));
    if (!key.apiKey)
      return fallback(AI_MODEL_CATALOG_WARNING.missingKey(provider));
    try {
      const response = await this.queue.get<T>(url, {
        feature: AiQueueFeature.PROVIDER_SETTINGS,
        timeout: AI_MODEL_CATALOG.requestMs,
        // Interactive: fall back to the default list instead of waiting
        // behind a long generation.
        waitMs: AI_MODEL_CATALOG.queueWaitMs,
      });
      const live = parse(response.data);
      if (!live.general.length && !live.image.length)
        return fallback(AI_MODEL_CATALOG_WARNING.empty(provider));
      return {
        models: live,
        source: AiModelCatalogSource.LIVE,
        isLive: true,
        warning: null,
      };
    } catch (error: unknown) {
      this.logger.warn(`Não foi possível consultar os modelos de ${provider}.`);
      return fallback(
        modelCatalogFailureWarning(provider, error, rejectedKeyStatuses),
      );
    }
  }

  async getOpenAiModels(): Promise<AiProviderModelsResponseDto> {
    return this.catalog<OpenAiModelListResponse>(
      'OpenAI',
      await this.get.getInternalOpenAiSettings(),
      OPENAI_API.models,
      openAiCatalogModels,
      {
        general: DEFAULT_OPENAI_GENERAL_MODELS,
        image: DEFAULT_OPENAI_IMAGE_MODELS,
      },
      AI_MODEL_CATALOG.openAiRejectedKeyStatuses,
    );
  }

  async getOpenAiSettings(): Promise<OpenAiSettingsResponseDto> {
    return this.get.getOpenAiSettings();
  }

  async saveOpenAiSettings(
    dto: SaveOpenAiSettingsDto,
  ): Promise<OpenAiSettingsResponseDto> {
    return this.update.saveOpenAiSettings(dto);
  }

  async getGeminiModels(): Promise<AiProviderModelsResponseDto> {
    return this.catalog<GeminiModelListResponse>(
      'Gemini',
      await this.get.getInternalGeminiSettings(),
      GEMINI_MODELS_URL,
      geminiCatalogModels,
      {
        general: DEFAULT_GEMINI_GENERAL_MODELS,
        image: DEFAULT_GEMINI_IMAGE_MODELS,
      },
      AI_MODEL_CATALOG.geminiRejectedKeyStatuses,
    );
  }

  async getGeminiSettings(): Promise<GeminiSettingsResponseDto> {
    return this.get.getGeminiSettings();
  }

  async saveGeminiSettings(
    dto: SaveGeminiSettingsDto,
  ): Promise<GeminiSettingsResponseDto> {
    return this.update.saveGeminiSettings(dto);
  }
}
