import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiProviderSettingRepository } from '../repositories/ai-provider-setting.repository';
import { GetAiProviderSettingsService } from './get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from './update-ai-provider-settings.service';
import { AiProvidersConfigService } from './ai-providers-config.service';
import {
  AiModelCatalogSource,
  AiProviderSettingsKey,
} from '../constants/ai-provider-settings.constants';
import { LessonLlmProvider } from '../providers/lesson-llm.types';
import {
  SaveAiProviderSettingsDto,
  SaveGeminiSettingsDto,
  SaveOpenAiSettingsDto,
} from '../dto/ai-provider-settings.dto';
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from '../aiProviderSettings.utils';

describe('Configurações de IA salvas no banco', () => {
  const rows = new Map<AiProviderSettingsKey, Record<string, unknown>>();
  const repo = {
    findByProvider: jest.fn((key: AiProviderSettingsKey) =>
      Promise.resolve(rows.get(key) ?? null),
    ),
    saveProviderSettings: jest.fn(),
    saveAllSettings: jest.fn(),
  };
  const getter = new GetAiProviderSettingsService(
    repo as unknown as AiProviderSettingRepository,
  );
  const updater = new UpdateAiProviderSettingsService(
    repo as unknown as AiProviderSettingRepository,
    getter,
  );

  beforeEach(() => {
    rows.clear();
    jest.clearAllMocks();
    repo.saveAllSettings.mockReset();
  });

  it('retorna números reais, preserva zero e não importa chaves ou provedor do ambiente', async () => {
    const previous = {
      provider: process.env.LLM_PROVIDER,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    };
    process.env.LLM_PROVIDER = 'gemini';
    process.env.OPENAI_API_KEY = 'environment-must-not-be-used';
    process.env.GEMINI_API_KEY = 'environment-must-not-be-used';
    try {
      rows.set(AiProviderSettingsKey.GEMINI, {
        maxRetries: '0',
        retryBaseDelayMs: '250',
      });
      const settings = await getter.getSettings();
      expect(settings.llmProvider).toBe(LessonLlmProvider.OPENAI);
      expect(settings.openai.hasApiKey).toBe(false);
      expect(
        (settings.openai as unknown as Record<string, unknown>).apiKey,
      ).toBeUndefined();
      expect(settings.gemini.hasApiKey).toBe(false);
      expect(
        (settings.gemini as unknown as Record<string, unknown>).apiKey,
      ).toBeUndefined();
      expect(settings.gemini.maxRetries).toBe(0);
      expect(settings.gemini.retryBaseDelayMs).toBe(250);

      const internal = await getter.getInternalSettings();
      expect(internal.openai.apiKey).toBe('');
      expect(internal.gemini.apiKey).toBe('');

      rows.set(AiProviderSettingsKey.ACTIVE, {
        llmProvider: LessonLlmProvider.GEMINI,
      });
      expect(await getter.getActiveProvider()).toBe(LessonLlmProvider.GEMINI);
    } finally {
      for (const [key, value] of Object.entries({
        LLM_PROVIDER: previous.provider,
        OPENAI_API_KEY: previous.openai,
        GEMINI_API_KEY: previous.gemini,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('T-B11: nunca expõe segredos em DTOs públicos de GET/PUT, mantém resolução interna e suporta preservar/limpar chaves', async () => {
    const syntheticOpenAiKey = 'sk-synthetic-openai-secret-12345';
    const syntheticGeminiKey = 'gemini-synthetic-secret-67890';

    rows.set(AiProviderSettingsKey.OPENAI, {
      generalModel: 'gpt-4o',
      imageModel: 'dall-e-3',
      imageQuality: 'standard',
      reasoningEffort: 'medium',
      apiKey: syntheticOpenAiKey,
    });
    rows.set(AiProviderSettingsKey.GEMINI, {
      generalModel: 'gemini-2.5-flash',
      fallbackModel: 'gemini-2.5-pro',
      imageModel: 'imagen-3.0',
      imageSize: '1024x1024',
      maxRetries: 3,
      retryBaseDelayMs: 1000,
      apiKey: syntheticGeminiKey,
    });

    // 1. GET público não contém chaves, mas informa hasApiKey
    const publicSettings = await getter.getSettings();
    expect(publicSettings.openai.hasApiKey).toBe(true);
    expect(publicSettings.gemini.hasApiKey).toBe(true);
    expect(JSON.stringify(publicSettings)).not.toContain(syntheticOpenAiKey);
    expect(JSON.stringify(publicSettings)).not.toContain(syntheticGeminiKey);
    expect(
      (publicSettings.openai as unknown as Record<string, unknown>).apiKey,
    ).toBeUndefined();
    expect(
      (publicSettings.gemini as unknown as Record<string, unknown>).apiKey,
    ).toBeUndefined();

    const publicOpenAi = await getter.getOpenAiSettings();
    expect(publicOpenAi.hasApiKey).toBe(true);
    expect(JSON.stringify(publicOpenAi)).not.toContain(syntheticOpenAiKey);

    const publicGemini = await getter.getGeminiSettings();
    expect(publicGemini.hasApiKey).toBe(true);
    expect(JSON.stringify(publicGemini)).not.toContain(syntheticGeminiKey);

    // 2. Resolução interna tem acesso aos segredos para chamadas autenticadas
    const internal = await getter.getInternalSettings();
    expect(internal.openai.apiKey).toBe(syntheticOpenAiKey);
    expect(internal.gemini.apiKey).toBe(syntheticGeminiKey);

    // 3. PUT preserva a chave quando apiKey for omitida (undefined)
    repo.saveProviderSettings.mockImplementation(
      (key: AiProviderSettingsKey, data: Record<string, unknown>) => {
        rows.set(key, data);
        return Promise.resolve();
      },
    );
    repo.saveAllSettings.mockImplementation(
      (data: {
        openai: Record<string, unknown>;
        gemini: Record<string, unknown>;
      }) => {
        rows.set(AiProviderSettingsKey.OPENAI, data.openai);
        rows.set(AiProviderSettingsKey.GEMINI, data.gemini);
        return Promise.resolve();
      },
    );

    const updatedOpenAi = await updater.saveOpenAiSettings({
      generalModel: 'gpt-4.5-preview',
    });
    expect(updatedOpenAi.generalModel).toBe('gpt-4.5-preview');
    expect(updatedOpenAi.hasApiKey).toBe(true);
    expect(JSON.stringify(updatedOpenAi)).not.toContain(syntheticOpenAiKey);
    expect(
      (rows.get(AiProviderSettingsKey.OPENAI) as Record<string, unknown>)
        .apiKey,
    ).toBe(syntheticOpenAiKey);

    // 4. PUT limpa a chave quando apiKey for string vazia
    const clearedOpenAi = await updater.saveOpenAiSettings({
      apiKey: '',
    });
    expect(clearedOpenAi.hasApiKey).toBe(false);
    expect(
      (rows.get(AiProviderSettingsKey.OPENAI) as Record<string, unknown>)
        .apiKey,
    ).toBe('');
  });

  it('salva a seleção e os dois provedores numa única operação e propaga falhas', async () => {
    repo.saveAllSettings.mockImplementation(
      (data: {
        llmProvider: LessonLlmProvider;
        openai: Record<string, unknown>;
        gemini: Record<string, unknown>;
      }) => {
        rows.set(AiProviderSettingsKey.OPENAI, data.openai);
        rows.set(AiProviderSettingsKey.GEMINI, data.gemini);
        rows.set(AiProviderSettingsKey.ACTIVE, {
          llmProvider: data.llmProvider,
        });
        return Promise.resolve();
      },
    );
    const settings = await getter.getSettings();
    const dto = {
      llmProvider: LessonLlmProvider.GEMINI,
      openai: { generalModel: settings.openai.generalModel },
      gemini: { generalModel: settings.gemini.generalModel },
    };
    const result = await updater.saveSettings(dto);
    expect(result.llmProvider).toBe(LessonLlmProvider.GEMINI);
    expect(repo.saveAllSettings).toHaveBeenCalled();
    expect(repo.saveProviderSettings).not.toHaveBeenCalled();
    repo.saveAllSettings.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );
    await expect(updater.saveSettings(dto)).rejects.toThrow(
      'Database unavailable',
    );
  });

  it('aceita parâmetros numéricos antigos em string e rejeita valores inválidos', async () => {
    const valid = plainToInstance(SaveGeminiSettingsDto, {
      maxRetries: '0',
      retryBaseDelayMs: '1000',
    });
    expect(await validate(valid)).toEqual([]);
    expect(valid.maxRetries).toBe(0);
    expect(valid.retryBaseDelayMs).toBe(1000);
    for (const maxRetries of [-1, 11, 1.5, 'invalid', null]) {
      expect(
        await validate(plainToInstance(SaveGeminiSettingsDto, { maxRetries })),
      ).not.toHaveLength(0);
    }
    expect(
      await validate(
        plainToInstance(SaveAiProviderSettingsDto, {
          llmProvider: 'other',
          openai: {},
          gemini: { retryBaseDelayMs: -1 },
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SaveOpenAiSettingsDto, {
          generalModel: null,
          apiKey: null,
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SaveOpenAiSettingsDto, {
          generalModel: 'x'.repeat(121),
        }),
      ),
    ).not.toHaveLength(0);
  });

  it('criptografa e descriptografa chaves de API com AES-256-GCM quando AI_PROVIDER_SETTINGS_ENCRYPTION_KEY está configurada', () => {
    const encryptionKey = 'synthetic-test-master-key-for-aes-gcm';
    const raw = 'sk-synthetic-secret-value-999';
    const encrypted = encryptProviderSecret(raw, encryptionKey);
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain(raw);
    expect(decryptProviderSecret(encrypted, encryptionKey)).toBe(raw);
    expect(decryptProviderSecret(encrypted, 'wrong-key')).toBe('');
    // Backward compatibility with legacy plaintext
    expect(decryptProviderSecret(raw, encryptionKey)).toBe(raw);
  });

  it('informa proveniência explícita (FALLBACK e STATIC) no catálogo de modelos quando não há consulta ao vivo', async () => {
    const configService = new AiProvidersConfigService(getter, updater);
    const openaiCatalog = await configService.getOpenAiModels();
    expect(openaiCatalog.source).toBe(AiModelCatalogSource.FALLBACK);
    expect(openaiCatalog.isLive).toBe(false);
    expect(openaiCatalog.warning).toContain('contingência');

    const geminiCatalog = await configService.getGeminiModels();
    expect(geminiCatalog.source).toBe(AiModelCatalogSource.STATIC);
    expect(geminiCatalog.isLive).toBe(false);
    expect(geminiCatalog.warning).toContain('Catálogo estático');
  });
});
