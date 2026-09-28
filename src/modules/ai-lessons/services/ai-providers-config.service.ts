import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiProviderSettingRepository } from '../repositories/ai-provider-setting.repository';
import { SaveGeminiSettingsDto, SaveOpenAiSettingsDto } from '../dto/ai-provider-settings.dto';

const DEFAULT_OPENAI_GENERAL_MODELS = [
  'gpt-6-luna',
  'gpt-5.6-luna',
  'gpt-5.6',
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'o1',
];

const DEFAULT_OPENAI_IMAGE_MODELS = [
  'gpt-image-2',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
  'gpt-image-1-mini',
  'dall-e-3',
];

const DEFAULT_GEMINI_GENERAL_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const DEFAULT_GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image',
  'imagen-3.0-generate-002',
];

@Injectable()
export class AiProvidersConfigService {
  private readonly logger = new Logger(AiProvidersConfigService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repo: AiProviderSettingRepository,
  ) {}

  /** 1. Lista os modelos da OpenAI consultando a API da OpenAI em tempo real */
  async getOpenAiModels(apiKeyParam?: string) {
    const keyToUse =
      apiKeyParam ||
      (await this.getOpenAiSettings()).apiKey ||
      this.config.get<string>('OPENAI_API_KEY');

    if (keyToUse) {
      try {
        const response = await axios.get('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${keyToUse}` },
          timeout: 5000,
        });

        const list: Array<{ id: string; created?: number }> =
          response.data?.data || [];

        const isImageModel = (id: string) =>
          id.startsWith('gpt-image-') || id.includes('dall-e');
        const isGeneralModel = (id: string) =>
          (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3')) &&
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
        };
      } catch (err) {
        this.logger.warn(`Falha ao buscar modelos na OpenAI API: ${err.message}`);
      }
    }

    return {
      models: {
        general: DEFAULT_OPENAI_GENERAL_MODELS,
        image: DEFAULT_OPENAI_IMAGE_MODELS,
      },
    };
  }

  /** 2. Busca as configurações salvas da OpenAI */
  async getOpenAiSettings() {
    const saved = await this.repo.findByProvider('openai');
    const defaultKey =
      this.config.get<string>('OPENAI_API_KEY') ||
      'REMOVED_OPENAI_API_KEY';

    return {
      generalModel:
        saved?.generalModel ||
        this.config.get<string>('OPENAI_TEXT_MODEL') ||
        'gpt-6-luna',
      imageModel:
        saved?.imageModel ||
        this.config.get<string>('OPENAI_IMAGE_MODEL') ||
        'gpt-image-2',
      imageQuality:
        saved?.imageQuality ||
        this.config.get<string>('OPENAI_IMAGE_QUALITY') ||
        'high',
      reasoningEffort:
        saved?.reasoningEffort ||
        this.config.get<string>('OPENAI_REASONING_EFFORT') ||
        'none',
      apiKey: saved?.apiKey || defaultKey,
    };
  }

  /** 3. Salva as configurações da OpenAI */
  async saveOpenAiSettings(dto: SaveOpenAiSettingsDto) {
    const current = await this.getOpenAiSettings();
    const updated = { ...current, ...dto };
    await this.repo.saveProviderSettings('openai', updated);
    return updated;
  }

  /** 4. Lista os modelos do Gemini */
  async getGeminiModels() {
    return {
      models: {
        general: DEFAULT_GEMINI_GENERAL_MODELS,
        image: DEFAULT_GEMINI_IMAGE_MODELS,
      },
    };
  }

  /** 5. Busca as configurações salvas do Gemini */
  async getGeminiSettings() {
    const saved = await this.repo.findByProvider('gemini');
    const defaultKey =
      this.config.get<string>('GEMINI_API_KEY') ||
      'REMOVED_GEMINI_API_KEY';

    return {
      generalModel:
        saved?.generalModel ||
        this.config.get<string>('GEMINI_TEXT_MODEL') ||
        'gemini-2.5-flash',
      fallbackModel:
        saved?.fallbackModel ||
        this.config.get<string>('GEMINI_TEXT_FALLBACK_MODEL') ||
        'gemini-2.0-flash',
      imageModel:
        saved?.imageModel ||
        this.config.get<string>('GEMINI_IMAGE_MODEL') ||
        'gemini-3.1-flash-image',
      imageSize:
        saved?.imageSize ||
        this.config.get<string>('GEMINI_IMAGE_SIZE') ||
        '2K',
      maxRetries:
        saved?.maxRetries ??
        (this.config.get<number>('GEMINI_MAX_RETRIES') || 3),
      retryBaseDelayMs:
        saved?.retryBaseDelayMs ??
        (this.config.get<number>('GEMINI_RETRY_BASE_DELAY_MS') || 1000),
      apiKey: saved?.apiKey || defaultKey,
    };
  }

  /** 6. Salva as configurações do Gemini */
  async saveGeminiSettings(dto: SaveGeminiSettingsDto) {
    const current = await this.getGeminiSettings();
    const updated = { ...current, ...dto };
    await this.repo.saveProviderSettings('gemini', updated);
    return updated;
  }
}
