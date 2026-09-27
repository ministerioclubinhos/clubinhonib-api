import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';
import { GeminiLessonLlmProvider } from './gemini-lesson-llm.provider';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

type AxiosPostCall = [
  url: string,
  body: Record<string, unknown>,
  options: { headers: Record<string, string>; timeout: number },
];

function lastPostCall(): AxiosPostCall {
  const call = mockedAxios.post.mock.lastCall;
  if (!call) throw new Error('axios.post não foi chamado');
  return call as AxiosPostCall;
}

describe('GeminiLessonLlmProvider', () => {
  const values: Record<string, string> = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_TEXT_MODEL: 'gemini-text-test',
    GEMINI_TEXT_FALLBACK_MODEL: 'gemini-text-fallback-test',
    GEMINI_IMAGE_MODEL: 'gemini-image-test',
    GEMINI_IMAGE_SIZE: '1K',
    GEMINI_MAX_RETRIES: '0',
    GEMINI_RETRY_BASE_DELAY_MS: '0',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  };
  const provider = new GeminiLessonLlmProvider(
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    mockedAxios.post.mockReset();
    config.get.mockClear();
    values.GEMINI_MAX_RETRIES = '0';
  });

  function unavailableError(): AxiosError {
    return {
      message: 'Service unavailable',
      response: {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {},
        config: { headers: {} } as never,
        data: { error: { status: 'UNAVAILABLE' } },
      },
    } as unknown as AxiosError;
  }

  it('gera conteúdo estruturado usando o schema da etapa', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        responseId: 'gemini-response-1',
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Lição de teste',
                    biblicalReference: 'João 3:16',
                  }),
                },
              ],
            },
          },
        ],
      },
    });

    const result = await provider.generateStage({
      theme: 'Amor de Deus',
      biblicalReference: 'João 3:16',
      weekNumber: 1,
      stage: LessonStageType.LESSON,
      template: LESSON_TEMPLATES[LessonStageType.LESSON],
      approvedUpstream: null,
      adminPrompt: '',
    });

    expect(result).toEqual({
      content: {
        title: 'Lição de teste',
        biblicalReference: 'João 3:16',
      },
      responseId: 'gemini-response-1',
    });
    const [url, body, options] = lastPostCall();
    expect(url).toContain('/models/gemini-text-test:generateContent');
    expect(body).toMatchObject({
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
    });
    expect(options.headers).toEqual({ 'x-goog-api-key': 'test-key' });
  });

  it('gera imagem com formato controlado pela orientação', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        id: 'image-1',
        outputImage: {
          data: Buffer.from('jpeg-content').toString('base64'),
          mimeType: 'image/jpeg',
        },
      },
    });

    const result = await provider.generateImage(
      'Uma cena bíblica infantil',
      'PORTRAIT',
      'INTERACTIVE_COLORING',
    );

    expect(result.toString()).toBe('jpeg-content');
    const [url, body, options] = lastPostCall();
    expect(url).toContain('/interactions');
    expect(body).toMatchObject({
      model: 'gemini-image-test',
      response_format: {
        type: 'image',
        aspect_ratio: '3:4',
        image_size: '1K',
      },
    });
    expect(options.headers).toEqual({ 'x-goog-api-key': 'test-key' });
  });

  it('repete a chamada quando o Gemini responde com erro transitório', async () => {
    values.GEMINI_MAX_RETRIES = '1';
    mockedAxios.post
      .mockRejectedValueOnce(unavailableError())
      .mockResolvedValueOnce({
        data: {
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ ok: true }) }] } },
          ],
        },
      });

    const result = await provider.generateStage({
      theme: 'Teste',
      biblicalReference: 'João 3:16',
      weekNumber: 1,
      stage: LessonStageType.LESSON,
      template: LESSON_TEMPLATES[LessonStageType.LESSON],
      approvedUpstream: null,
      adminPrompt: '',
    });

    expect(result.content).toEqual({ ok: true });
    expect(mockedAxios.post.mock.calls).toHaveLength(2);
    expect(mockedAxios.post.mock.calls[1][0]).toContain(
      '/models/gemini-text-test:generateContent',
    );
  });

  it('não repete quando o Free Tier possui cota diária zero', async () => {
    values.GEMINI_MAX_RETRIES = '3';
    mockedAxios.post.mockRejectedValueOnce({
      message: 'Too many requests',
      response: {
        status: 429,
        data: {
          error: {
            message:
              'Rate limit exceeded (limit: 0 requests per day on Free Tier).',
            code: 'too_many_requests',
          },
        },
      },
    } as AxiosError);

    await expect(provider.generateImage('imagem')).rejects.toThrow(
      'Falha no Gemini durante a geração de imagem',
    );
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('usa o modelo fallback após esgotar o modelo principal', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(unavailableError())
      .mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ fallback: true }) }],
              },
            },
          ],
        },
      });

    const result = await provider.generateStage({
      theme: 'Teste',
      biblicalReference: 'João 3:16',
      weekNumber: 1,
      stage: LessonStageType.LESSON,
      template: LESSON_TEMPLATES[LessonStageType.LESSON],
      approvedUpstream: null,
      adminPrompt: '',
    });

    expect(result.content).toEqual({ fallback: true });
    expect(mockedAxios.post.mock.calls[1][0]).toContain(
      '/models/gemini-text-fallback-test:generateContent',
    );
  });

  it('recusa geração quando a chave Gemini não está configurada', async () => {
    const missingConfig = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const missingProvider = new GeminiLessonLlmProvider(missingConfig);

    await expect(
      missingProvider.generateImage('imagem'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mockedAxios.post.mock.calls).toHaveLength(0);
  });
});
