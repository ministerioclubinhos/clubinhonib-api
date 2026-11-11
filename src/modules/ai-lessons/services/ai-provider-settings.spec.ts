import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
import { AiQueueFailure } from 'src/shared/providers/ai-queue/enums';
import { AiQueueFeature } from 'src/shared/providers/ai-queue/enums';
import { createAiQueueMock } from 'src/shared/providers/ai-queue/testing/queue.mock';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiProviderSettingRepository } from '../repositories/ai-provider-setting.repository';
import { GetAiProviderSettingsService } from './get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from './update-ai-provider-settings.service';
import { AiProvidersConfigService } from './ai-providers-config.service';
import {
  AI_PROVIDER_SECRET,
  AiModelCatalogSource,
  AiProviderSecretFailure,
  AiProviderSettingsKey,
} from '../constants/ai-provider-settings.constants';
import {
  StoredAiProviderSettings,
  StoredAiProviderSettingsMerge,
} from '../types/ai-provider-settings.types';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { LessonLlmProvider } from '../providers/lesson-llm.types';
import {
  SaveAiProviderSettingsDto,
  SaveGeminiSettingsDto,
  SaveOpenAiSettingsDto,
} from '../dto/ai-provider-settings.dto';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  ProviderSecretError,
  providerSecretNeedsRotation,
} from '../aiProviderSettings.utils';

describe('Configurações de IA salvas no banco', () => {
  const rows = new Map<AiProviderSettingsKey, Record<string, unknown>>();
  const repo = {
    findByProvider: jest.fn((key: AiProviderSettingsKey) =>
      Promise.resolve(rows.get(key) ?? null),
    ),
    // Mirrors the repository contract: read under lock, merge, write.
    updateLocked: jest.fn(
      (keys: AiProviderSettingsKey[], merge: StoredAiProviderSettingsMerge) => {
        const current: StoredAiProviderSettings = {};
        for (const key of keys) {
          const row = rows.get(key);
          if (row) current[key] = row;
        }
        for (const [key, value] of Object.entries(merge(current)))
          rows.set(key as AiProviderSettingsKey, value);
        return Promise.resolve();
      },
    ),
  };
  const environment = { value: 'local' };
  const getter = new GetAiProviderSettingsService(
    repo as unknown as AiProviderSettingRepository,
  );
  const updater = new UpdateAiProviderSettingsService(
    repo as unknown as AiProviderSettingRepository,
    getter,
    {
      get: (key: string) =>
        key === 'ENVIRONMENT' ? environment.value : undefined,
    } as unknown as ConfigService,
  );
  const masterKeyEnv = AI_PROVIDER_SECRET.currentKeyEnv;
  const previousKeyEnv = AI_PROVIDER_SECRET.previousKeyEnv;
  const withKeys = async (
    current: string | undefined,
    previous: string | undefined,
    run: () => Promise<void>,
  ): Promise<void> => {
    const saved = [process.env[masterKeyEnv], process.env[previousKeyEnv]];
    const assign = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    assign(masterKeyEnv, current);
    assign(previousKeyEnv, previous);
    try {
      await run();
    } finally {
      assign(masterKeyEnv, saved[0]);
      assign(previousKeyEnv, saved[1]);
    }
  };
  const storedKey = (provider: AiProviderSettingsKey): unknown =>
    rows.get(provider)?.apiKey;

  beforeEach(() => {
    rows.clear();
    jest.clearAllMocks();
    environment.value = 'local';
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
    rows.set(AiProviderSettingsKey.GEMINI, { apiKey: 'synthetic-gemini-key' });
    const settings = await getter.getSettings();
    const dto = {
      llmProvider: LessonLlmProvider.GEMINI,
      openai: { generalModel: settings.openai.generalModel },
      gemini: { generalModel: settings.gemini.generalModel },
    };
    const result = await updater.saveSettings(dto);
    expect(result.llmProvider).toBe(LessonLlmProvider.GEMINI);
    expect(repo.updateLocked).toHaveBeenCalledTimes(1);
    expect(repo.updateLocked.mock.calls[0][0]).toEqual([
      AiProviderSettingsKey.OPENAI,
      AiProviderSettingsKey.GEMINI,
      AiProviderSettingsKey.ACTIVE,
    ]);
    repo.updateLocked.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(updater.saveSettings(dto)).rejects.toThrow(
      'Database unavailable',
    );
  });

  it('merges over the row read under the lock, so a concurrent save is not lost', async () => {
    rows.set(AiProviderSettingsKey.OPENAI, {
      generalModel: 'gpt-old',
      imageModel: 'gpt-image-old',
    });
    repo.updateLocked.mockImplementationOnce(
      (keys: AiProviderSettingsKey[], merge: StoredAiProviderSettingsMerge) => {
        // Another session committed between this request's arrival and its lock.
        rows.set(AiProviderSettingsKey.OPENAI, {
          generalModel: 'gpt-old',
          imageModel: 'gpt-image-from-other-session',
        });
        const current = { [keys[0]]: rows.get(keys[0]) };
        for (const [key, value] of Object.entries(merge(current)))
          rows.set(key as AiProviderSettingsKey, value);
        return Promise.resolve();
      },
    );
    await updater.saveOpenAiSettings({ generalModel: 'gpt-new' });
    expect(rows.get(AiProviderSettingsKey.OPENAI)).toMatchObject({
      generalModel: 'gpt-new',
      imageModel: 'gpt-image-from-other-session',
    });
  });

  it('recusa ativar um provedor sem chave e clampa tentativas salvas acima do teto', async () => {
    await expect(
      updater.saveSettings({
        llmProvider: LessonLlmProvider.GEMINI,
        openai: {},
        gemini: {},
      }),
    ).rejects.toThrow('chave de API do provedor selecionado');
    expect(rows.has(AiProviderSettingsKey.ACTIVE)).toBe(false);
    rows.set(AiProviderSettingsKey.GEMINI, {
      maxRetries: 10,
      retryBaseDelayMs: 999999,
    });
    expect(await getter.getInternalGeminiSettings()).toMatchObject({
      maxRetries: 5,
      retryBaseDelayMs: 10000,
    });
  });

  it('aceita parâmetros numéricos antigos em string e rejeita valores inválidos', async () => {
    const valid = plainToInstance(SaveGeminiSettingsDto, {
      maxRetries: '0',
      retryBaseDelayMs: '1000',
    });
    expect(await validate(valid)).toEqual([]);
    expect(valid.maxRetries).toBe(0);
    expect(valid.retryBaseDelayMs).toBe(1000);
    for (const maxRetries of [-1, 6, 11, 1.5, 'invalid', null]) {
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

  it('rejeita opções fora das listas aceitas pelos provedores', async () => {
    for (const dto of [
      plainToInstance(SaveOpenAiSettingsDto, { imageQuality: 'ultra' }),
      plainToInstance(SaveOpenAiSettingsDto, { reasoningEffort: 'maximum' }),
      plainToInstance(SaveGeminiSettingsDto, { imageSize: '1024x1024' }),
    ])
      expect(await validate(dto)).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SaveOpenAiSettingsDto, {
          imageQuality: 'high',
          reasoningEffort: 'none',
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(SaveGeminiSettingsDto, { imageSize: '2K' }),
      ),
    ).toEqual([]);
  });

  describe('segredos em repouso', () => {
    const keys = { current: 'synthetic-master-key-A', previous: '' };
    const raw = 'sk-synthetic-secret-value-999';

    it('criptografa com AES-256-GCM v2, id de chave e vínculo ao provedor', () => {
      const encrypted = encryptProviderSecret(raw, 'openai', keys);
      expect(encrypted).toMatch(/^enc:v2:[0-9a-f]{8}:/);
      expect(encrypted).not.toContain(raw);
      expect(encryptProviderSecret(raw, 'openai', keys)).not.toBe(encrypted);
      expect(decryptProviderSecret(encrypted, 'openai', keys)).toBe(raw);
      // Legacy plaintext stays readable.
      expect(decryptProviderSecret(raw, 'openai', keys)).toBe(raw);
      // A ciphertext copied to another provider row does not authenticate.
      expect(() => decryptProviderSecret(encrypted, 'gemini', keys)).toThrow(
        AiProviderSecretFailure.DECRYPT_FAILED,
      );
    });

    it('distingue chave mestra ausente, desconhecida e valor corrompido — nunca devolve vazio', () => {
      const encrypted = encryptProviderSecret(raw, 'openai', keys);
      expect(() =>
        decryptProviderSecret(encrypted, 'openai', {
          current: '',
          previous: '',
        }),
      ).toThrow(AiProviderSecretFailure.MASTER_KEY_MISSING);
      expect(() =>
        decryptProviderSecret(encrypted, 'openai', {
          current: 'another-key',
          previous: '',
        }),
      ).toThrow(AiProviderSecretFailure.UNKNOWN_KEY_ID);
      expect(() =>
        decryptProviderSecret('enc:v2:broken', 'openai', keys),
      ).toThrow(AiProviderSecretFailure.MALFORMED);
      expect(() =>
        decryptProviderSecret(`${encrypted.slice(0, -4)}AAAA`, 'openai', keys),
      ).toThrow(ProviderSecretError);
    });

    it('lê valores da chave anterior e do formato enc:v1 durante a rotação', () => {
      const rotated = {
        current: 'synthetic-master-key-B',
        previous: keys.current,
      };
      const old = encryptProviderSecret(raw, 'openai', keys);
      expect(decryptProviderSecret(old, 'openai', rotated)).toBe(raw);
      expect(providerSecretNeedsRotation(old, rotated)).toBe(true);
      expect(providerSecretNeedsRotation(old, keys)).toBe(false);

      // enc:v1 as written by the previous implementation: sha256 key, no AAD.
      const iv = randomBytes(12);
      const cipher = createCipheriv(
        'aes-256-gcm',
        createHash('sha256').update(keys.current, 'utf8').digest(),
        iv,
      );
      const body = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
      const v1 = `enc:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${body.toString('base64')}`;
      expect(decryptProviderSecret(v1, 'openai', keys)).toBe(raw);
      expect(providerSecretNeedsRotation(v1, keys)).toBe(true);
    });

    it('preserva o ciphertext salvo quando a chave mestra some ou muda, em vez de apagá-lo', async () => {
      await withKeys('synthetic-master-key-A', undefined, async () => {
        await updater.saveOpenAiSettings({ apiKey: raw });
      });
      const ciphertext = storedKey(AiProviderSettingsKey.OPENAI);
      expect(ciphertext).toMatch(/^enc:v2:/);

      for (const broken of [undefined, 'synthetic-wrong-master-key']) {
        await withKeys(broken, undefined, async () => {
          const errors = jest
            .spyOn(Logger.prototype, 'error')
            .mockImplementation(() => undefined);
          const settings = await getter.getInternalOpenAiSettings();
          expect(settings).toMatchObject({
            apiKey: '',
            apiKeyUnreadable: true,
          });
          expect(errors).toHaveBeenCalledWith(
            expect.stringContaining('ilegível'),
          );
          expect(await getter.getOpenAiSettings()).toMatchObject({
            hasApiKey: false,
            apiKeyUnreadable: true,
          });
          await updater.saveOpenAiSettings({ generalModel: 'gpt-4o' });
          errors.mockRestore();
        });
        expect(storedKey(AiProviderSettingsKey.OPENAI)).toBe(ciphertext);
        expect(rows.get(AiProviderSettingsKey.OPENAI)).not.toHaveProperty(
          'apiKeyUnreadable',
        );
      }

      await withKeys('synthetic-master-key-A', undefined, async () => {
        expect((await getter.getInternalOpenAiSettings()).apiKey).toBe(raw);
      });
    });

    it('migra texto puro e chave anterior no próximo salvamento e remove só por ação explícita', async () => {
      rows.set(AiProviderSettingsKey.GEMINI, { apiKey: raw });
      await withKeys(
        'synthetic-master-key-B',
        'synthetic-master-key-A',
        async () => {
          await updater.saveGeminiSettings({
            generalModel: 'gemini-2.5-flash',
          });
          const migrated = storedKey(AiProviderSettingsKey.GEMINI);
          expect(migrated).toMatch(/^enc:v2:/);
          expect((await getter.getInternalGeminiSettings()).apiKey).toBe(raw);
          await updater.saveGeminiSettings({ generalModel: 'gemini-2.5-pro' });
          expect(storedKey(AiProviderSettingsKey.GEMINI)).toBe(migrated);
          await updater.saveGeminiSettings({ apiKey: '' });
          expect(storedKey(AiProviderSettingsKey.GEMINI)).toBe('');
        },
      );
    });

    it('recusa valores já cifrados e, em produção, uma nova chave sem chave mestra', async () => {
      await expect(
        updater.saveOpenAiSettings({ apiKey: 'enc:v2:aaaaaaaa:x:y:z:w' }),
      ).rejects.toThrow('não é válida');
      await withKeys(undefined, undefined, async () => {
        environment.value = 'production';
        await expect(
          updater.saveOpenAiSettings({ apiKey: raw }),
        ).rejects.toThrow(masterKeyEnv);
        expect(rows.has(AiProviderSettingsKey.OPENAI)).toBe(false);
        // Outside production the plaintext fallback keeps local setups working.
        environment.value = 'local';
        await updater.saveOpenAiSettings({ apiKey: raw });
        expect(storedKey(AiProviderSettingsKey.OPENAI)).toBe(raw);
      });
    });

    it('avisa na subida quando a chave mestra está ausente', async () => {
      await withKeys(undefined, undefined, () => {
        const warnings = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        getter.onModuleInit();
        expect(warnings).toHaveBeenCalledWith(
          expect.stringContaining(masterKeyEnv),
        );
        warnings.mockRestore();
        return Promise.resolve();
      });
    });
  });

  it('queries the live model catalog through the queue without copying credentials and keeps its offline fallback', async () => {
    rows.set(AiProviderSettingsKey.OPENAI, { apiKey: 'synthetic-saved-key' });
    const queued = createAiQueueMock();
    const service = new AiProvidersConfigService(
      getter,
      updater,
      queued.service,
    );
    queued.get.mockResolvedValue({
      data: { data: [{ id: 'gpt-custom-model' }, { id: 'dall-e-3' }] },
    });
    const live = await service.getOpenAiModels();
    expect(live.source).toBe(AiModelCatalogSource.LIVE);
    expect(live.models.general).toContain('gpt-custom-model');
    // Families the Studio cannot drive are not offered.
    expect(live.models.image).not.toContain('dall-e-3');
    expect(queued.get).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      {
        feature: AiQueueFeature.PROVIDER_SETTINGS,
        timeout: 5000,
        waitMs: 10000,
      },
    );
    expect(JSON.stringify(queued.get.mock.calls)).not.toContain(
      'synthetic-saved-key',
    );
    queued.get.mockRejectedValue(
      new AiQueueException(AiQueueFailure.UNAVAILABLE),
    );
    expect((await service.getOpenAiModels()).source).toBe(
      AiModelCatalogSource.FALLBACK,
    );
  });

  it('informa proveniência explícita (FALLBACK e STATIC) no catálogo de modelos quando não há consulta ao vivo', async () => {
    const configService = new AiProvidersConfigService(
      getter,
      updater,
      createAiQueueMock().service,
    );
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
