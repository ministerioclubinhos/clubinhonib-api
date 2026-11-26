import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AiProvidersController } from './ai-providers.controller';
import { AiProvidersConfigService } from '../services/ai-providers-config.service';
import { GetAiProviderSettingsService } from '../services/get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from '../services/update-ai-provider-settings.service';
import { AiModelCatalogSource } from '../constants/ai-provider-settings.constants';
import { LessonLlmProvider } from '../providers/lesson-llm.types';

describe('AiProvidersController', () => {
  const configService = {
    getOpenAiModels: jest.fn(),
    getOpenAiSettings: jest.fn(),
    saveOpenAiSettings: jest.fn(),
    getGeminiModels: jest.fn(),
    getGeminiSettings: jest.fn(),
    saveGeminiSettings: jest.fn(),
  };

  const getService = {
    getSettings: jest.fn(),
  };

  const updateService = {
    saveSettings: jest.fn(),
  };

  let controller: AiProvidersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AiProvidersController(
      configService as unknown as AiProvidersConfigService,
      getService as unknown as GetAiProviderSettingsService,
      updateService as unknown as UpdateAiProviderSettingsService,
    );
  });

  it('protege o controller com JwtAuthGuard e AdminRoleGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AiProvidersController,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, AdminRoleGuard]);
  });

  it('consulta modelos da OpenAI e do Gemini sem aceitar chave via query string e preservando proveniência', async () => {
    configService.getOpenAiModels.mockResolvedValue({
      models: { general: ['gpt-6-luna'], image: ['gpt-image-2'] },
      source: AiModelCatalogSource.FALLBACK,
      isLive: false,
      warning: 'Contingência',
    });
    configService.getGeminiModels.mockResolvedValue({
      models: {
        general: ['gemini-2.5-flash'],
        image: ['gemini-3.1-flash-image'],
      },
      source: AiModelCatalogSource.STATIC,
      isLive: false,
      warning: 'Catálogo estático',
    });

    const openaiModels = await controller.getOpenAiModels();
    expect(configService.getOpenAiModels).toHaveBeenCalledWith();
    expect(openaiModels.source).toBe(AiModelCatalogSource.FALLBACK);
    expect(openaiModels.isLive).toBe(false);

    const geminiModels = await controller.getGeminiModels();
    expect(configService.getGeminiModels).toHaveBeenCalledWith();
    expect(geminiModels.source).toBe(AiModelCatalogSource.STATIC);
    expect(geminiModels.isLive).toBe(false);
  });

  it('delega leitura e atualização de configurações sem expor apiKey', async () => {
    const publicDto = {
      llmProvider: LessonLlmProvider.OPENAI,
      openai: {
        generalModel: 'gpt-6-luna',
        imageModel: 'gpt-image-2',
        imageQuality: 'high',
        reasoningEffort: 'none',
        hasApiKey: true,
      },
      gemini: {
        generalModel: 'gemini-2.5-flash',
        fallbackModel: 'gemini-2.0-flash',
        imageModel: 'gemini-3.1-flash-image',
        imageSize: '1K',
        maxRetries: 3,
        retryBaseDelayMs: 1000,
        hasApiKey: false,
      },
    };
    getService.getSettings.mockResolvedValue(publicDto);
    updateService.saveSettings.mockResolvedValue(publicDto);

    expect(await controller.getSettings()).toEqual(publicDto);
    expect(
      await controller.saveSettings({
        llmProvider: LessonLlmProvider.OPENAI,
        openai: { generalModel: 'gpt-6-luna' },
        gemini: { generalModel: 'gemini-2.5-flash' },
      }),
    ).toEqual(publicDto);
  });
});
