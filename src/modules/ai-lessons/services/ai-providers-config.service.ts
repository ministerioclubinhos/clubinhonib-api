import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GetAiProviderSettingsService } from './get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from './update-ai-provider-settings.service';
import {
  AiProviderModelsResponseDto,
  OpenAiModelListResponse,
  OpenAiSettingsResponseDto,
  GeminiSettingsResponseDto,
} from '../dto/ai-provider-settings-response.dto';
import {
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

@Injectable()
export class AiProvidersConfigService {
  private readonly logger = new Logger(AiProvidersConfigService.name);

  constructor(
    private readonly get: GetAiProviderSettingsService,
    private readonly update: UpdateAiProviderSettingsService,
  ) {}

  /** 1. Lista os modelos da OpenAI consultando a API da OpenAI em tempo real */
  async getOpenAiModels(): Promise<AiProviderModelsResponseDto> {
    const keyToUse = (await this.get.getInternalOpenAiSettings()).apiKey;

    if (keyToUse) {
      try {
        const response = await axios.get<OpenAiModelListResponse>(
          'https://api.openai.com/v1/models',
          {
            headers: { Authorization: `Bearer ${keyToUse}` },
            timeout: 5000,
          },
        );

        const list: Array<{ id: string; created?: number }> =
          response.data?.data || [];

        const isImageModel = (id: string) =>
          id.startsWith('gpt-image-') || id.includes('dall-e');
        const isGeneralModel = (id: string) =>
          (id.startsWith('gpt-') ||
            id.startsWith('o1') ||
            id.startsWith('o3')) &&
          !isImageModel(id) &&
          !id.includes('realtime') &&
          !id.includes('transcribe') &&
          !id.includes('tts') &&
          !id.includes('whisper') &&
          !id.includes('embedding');

        const sorted = [...list].sort(
          (a, b) => (b.created ?? 0) - (a.created ?? 0),
        );

        const fetchedImage = sorted
          .filter((m) => isImageModel(m.id))
          .map((m) => m.id);
        const fetchedGeneral = sorted
          .filter((m) => isGeneralModel(m.id))
          .map((m) => m.id);

        return {
          models: {
            general: Array.from(
              new Set([...fetchedGeneral, ...DEFAULT_OPENAI_GENERAL_MODELS]),
            ),
            image: Array.from(
              new Set([...fetchedImage, ...DEFAULT_OPENAI_IMAGE_MODELS]),
            ),
          },
          source: AiModelCatalogSource.LIVE,
          isLive: true,
          warning: null,
        };
      } catch {
        this.logger.warn('Não foi possível consultar os modelos da OpenAI.');
      }
    }

    return {
      models: {
        general: DEFAULT_OPENAI_GENERAL_MODELS,
        image: DEFAULT_OPENAI_IMAGE_MODELS,
      },
      source: AiModelCatalogSource.FALLBACK,
      isLive: false,
      warning: keyToUse
        ? 'Não foi possível consultar o catálogo em tempo real da OpenAI; exibindo a lista padrão de contingência.'
        : 'Nenhuma chave da OpenAI configurada; exibindo a lista padrão de contingência.',
    };
  }

  /** 2. Busca as configurações salvas da OpenAI */
  async getOpenAiSettings(): Promise<OpenAiSettingsResponseDto> {
    return this.get.getOpenAiSettings();
  }

  async saveOpenAiSettings(
    dto: SaveOpenAiSettingsDto,
  ): Promise<OpenAiSettingsResponseDto> {
    return this.update.saveOpenAiSettings(dto);
  }

  /** 4. Lista os modelos do Gemini */
  getGeminiModels(): Promise<AiProviderModelsResponseDto> {
    return Promise.resolve({
      models: {
        general: DEFAULT_GEMINI_GENERAL_MODELS,
        image: DEFAULT_GEMINI_IMAGE_MODELS,
      },
      source: AiModelCatalogSource.STATIC,
      isLive: false,
      warning:
        'Catálogo estático de modelos compatíveis com o Gemini no Studio Clubinho.',
    });
  }

  /** 5. Busca as configurações salvas do Gemini */
  async getGeminiSettings(): Promise<GeminiSettingsResponseDto> {
    return this.get.getGeminiSettings();
  }

  async saveGeminiSettings(
    dto: SaveGeminiSettingsDto,
  ): Promise<GeminiSettingsResponseDto> {
    return this.update.saveGeminiSettings(dto);
  }
}
