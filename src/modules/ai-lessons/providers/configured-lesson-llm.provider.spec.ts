import { pngImageFixture } from '../fixtures/provider-image.fixture';
import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
import { AiQueueFailure } from 'src/shared/providers/ai-queue/enums';
import { createAiQueueMock } from 'src/shared/providers/ai-queue/testing/queue.mock';
import { AiQueueFeature } from 'src/shared/providers/ai-queue/enums';
import { GetAiProviderSettingsService } from '../services/get-ai-provider-settings.service';
import { InternalAiProviderSettings } from '../types/ai-provider-settings.types';
import { ConfiguredLessonLlmProvider } from './configured-lesson-llm.provider';
import { LessonLlmProvider } from './lesson-llm.types';
import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';

const queued = createAiQueueMock();

describe('Provedor selecionado na página de configurações', () => {
  const settings: InternalAiProviderSettings = {
    llmProvider: LessonLlmProvider.GEMINI,
    openai: {
      apiKey: 'saved-openai-key',
      generalModel: 'saved-openai-text',
      imageModel: 'saved-openai-image',
      imageQuality: 'medium',
      reasoningEffort: 'low',
    },
    gemini: {
      apiKey: 'saved-gemini-key',
      generalModel: 'saved-gemini-text',
      fallbackModel: 'saved-gemini-fallback',
      imageModel: 'saved-gemini-image',
      imageSize: '4K',
      maxRetries: 0,
      retryBaseDelayMs: 0,
    },
  };
  const getter = {
    getInternalSettings: jest.fn(() => Promise.resolve(settings)),
    getSettings: jest.fn(() => Promise.resolve(settings)),
  };
  const provider = new ConfiguredLessonLlmProvider(
    getter as unknown as GetAiProviderSettingsService,
    queued.service,
  );
  const input = {
    theme: 'Amor',
    biblicalReference: 'João 3:16',
    weekNumber: 1,
    stage: LessonStageType.LESSON,
    template: LESSON_TEMPLATES[LessonStageType.LESSON],
    approvedUpstream: null,
    adminPrompt: 'Aula completa.',
  };

  beforeEach(() => {
    queued.post.mockReset();
    settings.llmProvider = LessonLlmProvider.GEMINI;
  });

  it.each([LessonLlmProvider.OPENAI, LessonLlmProvider.GEMINI])(
    'preserves queue failure without extra attempts for %s text and image',
    async (providerKey) => {
      settings.llmProvider = providerKey;
      const failure = new AiQueueException(AiQueueFailure.UNAVAILABLE);
      queued.post.mockRejectedValue(failure);
      await expect(provider.generateStage(input)).rejects.toBe(failure);
      expect(queued.post).toHaveBeenCalledTimes(1);
      queued.post.mockClear();
      await expect(provider.generateImage('Cena')).rejects.toBe(failure);
      expect(queued.post).toHaveBeenCalledTimes(1);
    },
  );

  it('usa Gemini com chave e modelo salvos, e aplica uma troca sem reiniciar', async () => {
    queued.post.mockResolvedValueOnce({
      data: {
        candidates: [{ content: { parts: [{ text: '{"title":"Lição"}' }] } }],
      },
    });
    await provider.generateStage(input);
    const geminiCall = queued.post.mock.lastCall;
    expect(geminiCall?.[0]).toContain(
      '/models/saved-gemini-text:generateContent',
    );
    expect(geminiCall?.[2]).toMatchObject({
      feature: AiQueueFeature.LESSONS,
    });
    expect(
      queued.post.mock.calls.every(([url]) => !url.includes('openai.com')),
    ).toBe(true);
    settings.llmProvider = LessonLlmProvider.OPENAI;
    queued.post.mockResolvedValueOnce({
      data: { id: 'response', output_text: '{"title":"Lição"}' },
    });
    await provider.generateStage(input);
    expect(queued.post.mock.lastCall?.[0]).toBe(
      'https://api.openai.com/v1/responses',
    );
    expect(queued.post.mock.lastCall?.[1]).toMatchObject({
      model: 'saved-openai-text',
    });
    expect(queued.post.mock.lastCall?.[2]).toMatchObject({
      feature: AiQueueFeature.LESSONS,
    });
  });

  it('usa também os parâmetros de imagem salvos do Gemini', async () => {
    queued.post.mockResolvedValueOnce({
      data: {
        outputImage: { data: pngImageFixture('image').toString('base64') },
      },
    });
    expect(
      (await provider.generateImage('Cena.', 'LANDSCAPE')).equals(
        pngImageFixture('image'),
      ),
    ).toBe(true);
    expect(queued.post.mock.lastCall?.[1]).toMatchObject({
      model: 'saved-gemini-image',
      response_format: { image_size: '4K' },
    });
  });

  it('não tenta OpenAI quando a chave Gemini está ausente', async () => {
    const key = settings.gemini.apiKey;
    settings.gemini.apiKey = '';
    try {
      await expect(provider.generateStage(input)).rejects.toThrow(
        'GEMINI_API_KEY',
      );
      expect(queued.post.mock.calls).toHaveLength(0);
    } finally {
      settings.gemini.apiKey = key;
    }
  });

  it('retoma uma tentativa com todos os parâmetros congelados, sem ler os atuais nem a chave', async () => {
    const first = await provider.createAttemptProvider();
    expect(first.metadata).toEqual({
      provider: LessonLlmProvider.GEMINI,
      textModel: 'saved-gemini-text',
      imageModel: 'saved-gemini-image',
      imageQuality: 'medium',
      reasoningEffort: 'low',
      fallbackModel: 'saved-gemini-fallback',
      imageSize: '4K',
      maxRetries: 0,
      retryBaseDelayMs: 0,
    });
    expect(JSON.stringify(first.metadata)).not.toContain('saved-gemini-key');

    const previous = { ...settings.gemini };
    Object.assign(settings.gemini, {
      generalModel: 'changed-text',
      fallbackModel: 'changed-fallback',
      imageModel: 'changed-image',
      imageSize: '1K',
    });
    try {
      const resumed = await provider.createAttemptProvider(first.metadata);
      expect(resumed.metadata).toEqual(first.metadata);
      queued.post.mockResolvedValueOnce({
        data: {
          outputImage: { data: pngImageFixture('image').toString('base64') },
        },
      });
      await resumed.provider.generateImage('Cena.', 'LANDSCAPE');
      expect(queued.post.mock.lastCall?.[1]).toMatchObject({
        model: 'saved-gemini-image',
        response_format: { image_size: '4K' },
      });
    } finally {
      Object.assign(settings.gemini, previous);
    }
  });

  it('limita tentativas congeladas ao teto atual e não ecoa provedor inválido', async () => {
    const snapshot = await provider.createAttemptProvider({
      provider: LessonLlmProvider.GEMINI,
      textModel: 't',
      imageModel: 'i',
      maxRetries: 999,
      retryBaseDelayMs: 9_999_999,
    });
    expect(snapshot.metadata.maxRetries).toBe(5);
    expect(snapshot.metadata.retryBaseDelayMs).toBe(10000);
    await expect(
      provider.createAttemptProvider({
        provider: '<script>',
        textModel: 't',
        imageModel: 'i',
      }),
    ).rejects.toThrow('Provedor de IA inválido. Use openai ou gemini.');
  });
});
