import { ServiceUnavailableException } from '@nestjs/common';
import { LESSON_BASE_PROMPT } from '../constants/lesson-editorial.constants';
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

  it('sends the actual numbered artwork to the independent review schema', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        responseId: 'review',
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: '{"issues":[]}' }] },
          },
        ],
      },
    });
    await provider.generateStage({
      theme: 'Tema livre',
      biblicalReference: 'Referência',
      weekNumber: 1,
      stage: LessonStageType.MEDITATION_OLDER,
      template: LESSON_TEMPLATES[LessonStageType.MEDITATION_OLDER],
      approvedUpstream: { story: 'Fonte aprovada.' },
      adminPrompt: 'Não deve orientar a revisão.',
      olderMeditationReview: {
        content: {},
        images: [
          {
            activityNumber: 3,
            image: { data: Buffer.from('art'), mimeType: 'image/png' },
          },
        ],
      },
    });
    const [, body] = lastPostCall();
    expect(JSON.stringify(body.contents)).toContain('inlineData');
    expect(JSON.stringify(body.contents)).toContain(
      Buffer.from('art').toString('base64'),
    );
    expect(JSON.stringify(body.contents)).toContain('desafio 3');
    expect(JSON.stringify(body.contents)).not.toContain('Não deve orientar');
    expect(JSON.stringify(body.generationConfig)).toContain('issues');
  });

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
      adminPrompt: LESSON_BASE_PROMPT,
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
        responseJsonSchema: {
          type: 'object',
          properties: { reviewQuestions: { minItems: 8, maxItems: 10 } },
        },
      },
    });
    const contents = body.contents as Array<{ parts: Array<{ text: string }> }>;
    const sent = JSON.parse(contents[0].parts[0].text) as {
      adminPrompt: string;
    };
    expect(sent.adminPrompt).toBe(LESSON_BASE_PROMPT);
    expect(sent.adminPrompt).toContain(
      'Nunca copie essas descrições para story',
    );
    expect(options.headers).toEqual({ 'x-goog-api-key': 'test-key' });
  });

  it.each(['MAX_TOKENS', 'RECITATION', 'SAFETY'])(
    'rejeita texto com término %s mesmo quando o JSON é válido',
    async (finishReason) => {
      mockedAxios.post.mockResolvedValue({
        data: {
          candidates: [
            {
              finishReason,
              content: { parts: [{ text: '{"title":"Conteúdo parcial"}' }] },
            },
          ],
        },
      });
      await expect(
        provider.generateStage({
          theme: 'Tema qualquer',
          biblicalReference: 'João 3:16',
          weekNumber: 1,
          stage: LessonStageType.LESSON,
          template: LESSON_TEMPLATES[LessonStageType.LESSON],
          approvedUpstream: null,
          adminPrompt: LESSON_BASE_PROMPT,
        }),
      ).rejects.toThrow(finishReason);
      expect(mockedAxios.post.mock.calls).toHaveLength(2);
    },
  );

  it('usa o fallback configurado quando a resposta principal foi interrompida', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            finishReason: 'MAX_TOKENS',
            content: { parts: [{ text: '{"title":"Parcial"}' }] },
          },
        ],
      },
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        responseId: 'complete',
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: '{"title":"Completo"}' }] },
          },
        ],
      },
    });
    const result = await provider.generateStage({
      theme: 'Tema qualquer',
      biblicalReference: 'João 3:16',
      weekNumber: 1,
      stage: LessonStageType.LESSON,
      template: LESSON_TEMPLATES[LessonStageType.LESSON],
      approvedUpstream: null,
      adminPrompt: LESSON_BASE_PROMPT,
    });
    expect(result.content).toEqual({ title: 'Completo' });
    expect(lastPostCall()[0]).toContain('gemini-text-fallback-test');
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

  it('envia a imagem-mãe junto do prompt das cenas seguintes', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        outputImage: {
          data: Buffer.from('next-scene').toString('base64'),
          mimeType: 'image/png',
        },
      },
    });

    await provider.generateImage(
      'Cena seguinte',
      'LANDSCAPE',
      'STORY_SEQUENCE',
      {
        data: Buffer.from('identity-reference'),
        mimeType: 'image/png',
      },
    );

    const [, body] = lastPostCall();
    expect(body.input).toEqual([
      expect.objectContaining({ type: 'text' }),
      {
        type: 'image',
        data: Buffer.from('identity-reference').toString('base64'),
        mime_type: 'image/png',
      },
    ]);
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
    expect(mockedAxios.post.mock.calls).toHaveLength(1);
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
