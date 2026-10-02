import axios from 'axios';
import { GetAiProviderSettingsService } from '../services/get-ai-provider-settings.service';
import { AiProviderSettingsResponseDto } from '../dto/ai-provider-settings-response.dto';
import { ConfiguredLessonLlmProvider } from './configured-lesson-llm.provider';
import { LessonLlmProvider } from './lesson-llm.types';
import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Provedor selecionado na página de configurações', () => {
  const settings: AiProviderSettingsResponseDto = {
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
  const getter = { getSettings: jest.fn(() => Promise.resolve(settings)) };
  const provider = new ConfiguredLessonLlmProvider(
    getter as unknown as GetAiProviderSettingsService,
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
    mockedAxios.post.mockReset();
    settings.llmProvider = LessonLlmProvider.GEMINI;
  });

  it('usa Gemini com chave e modelo salvos, e aplica uma troca sem reiniciar', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        candidates: [{ content: { parts: [{ text: '{"title":"Lição"}' }] } }],
      },
    });
    await provider.generateStage(input);
    const geminiCall = mockedAxios.post.mock.lastCall;
    expect(geminiCall?.[0]).toContain(
      '/models/saved-gemini-text:generateContent',
    );
    expect(geminiCall?.[2]).toMatchObject({
      headers: { 'x-goog-api-key': 'saved-gemini-key' },
    });
    expect(
      mockedAxios.post.mock.calls.every(([url]) => !url.includes('openai.com')),
    ).toBe(true);
    settings.llmProvider = LessonLlmProvider.OPENAI;
    mockedAxios.post.mockResolvedValueOnce({
      data: { id: 'response', output_text: '{"title":"Lição"}' },
    });
    await provider.generateStage(input);
    expect(mockedAxios.post.mock.lastCall?.[0]).toBe(
      'https://api.openai.com/v1/responses',
    );
    expect(mockedAxios.post.mock.lastCall?.[1]).toMatchObject({
      model: 'saved-openai-text',
    });
    expect(mockedAxios.post.mock.lastCall?.[2]).toMatchObject({
      headers: { Authorization: 'Bearer saved-openai-key' },
    });
  });

  it('usa também os parâmetros de imagem salvos do Gemini', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { outputImage: { data: Buffer.from('image').toString('base64') } },
    });
    expect(
      (await provider.generateImage('Cena.', 'LANDSCAPE')).toString(),
    ).toBe('image');
    expect(mockedAxios.post.mock.lastCall?.[1]).toMatchObject({
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
      expect(mockedAxios.post.mock.calls).toHaveLength(0);
    } finally {
      settings.gemini.apiKey = key;
    }
  });
});
