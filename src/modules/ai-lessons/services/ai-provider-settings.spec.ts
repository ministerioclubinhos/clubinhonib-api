import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiProviderSettingRepository } from '../repositories/ai-provider-setting.repository';
import { GetAiProviderSettingsService } from './get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from './update-ai-provider-settings.service';
import { AiProviderSettingsKey } from '../constants/ai-provider-settings.constants';
import { LessonLlmProvider } from '../providers/lesson-llm.types';
import {
  SaveAiProviderSettingsDto,
  SaveGeminiSettingsDto,
} from '../dto/ai-provider-settings.dto';

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
      expect(settings.openai.apiKey).toBe('');
      expect(settings.gemini.apiKey).toBe('');
      expect(settings.gemini.maxRetries).toBe(0);
      expect(settings.gemini.retryBaseDelayMs).toBe(250);
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

  it('salva a seleção e os dois provedores numa única operação e propaga falhas', async () => {
    const settings = await getter.getSettings();
    const dto = { ...settings, llmProvider: LessonLlmProvider.GEMINI };
    await expect(updater.saveSettings(dto)).resolves.toEqual(dto);
    expect(repo.saveAllSettings).toHaveBeenCalledWith(dto);
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
  });
});
