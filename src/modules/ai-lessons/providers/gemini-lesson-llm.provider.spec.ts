import { pngImageFixture } from '../fixtures/provider-image.fixture';
import { createAiQueueMock } from 'src/shared/providers/ai-queue/testing/queue.mock';
import { AiQueueFeature } from 'src/shared/providers/ai-queue/enums';
import { ServiceUnavailableException } from '@nestjs/common';
import { LESSON_BASE_PROMPT } from '../constants/lesson-editorial.constants';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';
import { GeminiLessonLlmProvider } from './gemini-lesson-llm.provider';

const queued = createAiQueueMock();

type AxiosPostCall = [
  url: string,
  body: Record<string, unknown>,
  options: { feature: AiQueueFeature; timeout: number },
];

function lastPostCall(): AxiosPostCall {
  const call = queued.post.mock.lastCall;
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
    queued.service,
  );

  beforeEach(() => {
    queued.post.mockReset();
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
    queued.post.mockResolvedValueOnce({
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

  it('envia o pedido estruturado próprio no lugar do template da etapa', async () => {
    queued.post.mockResolvedValueOnce({
      data: {
        responseId: 'brief',
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: '{"artDirection":"Traço limpo"}' }] },
          },
        ],
      },
    });

    const result = await provider.generateStructured(
      {
        name: 'clubinho_image_brief',
        label: 'prompt mestre de imagens',
        system: 'SISTEMA DO DIRETOR DE ARTE',
        user: '{"licao":"dados"}',
        schema: { type: 'object', properties: { artDirection: {} } },
      },
      {
        theme: 'Tema livre',
        biblicalReference: 'Referência',
        weekNumber: 1,
        stage: LessonStageType.LESSON_VISUALS,
        template: LESSON_TEMPLATES[LessonStageType.LESSON_VISUALS],
        approvedUpstream: null,
        adminPrompt: 'Orientação da etapa',
      },
    );

    const [, body] = lastPostCall();
    expect(JSON.stringify(body.systemInstruction)).toContain(
      'SISTEMA DO DIRETOR DE ARTE',
    );
    expect(JSON.stringify(body.contents)).toContain('licao');
    expect(JSON.stringify(body.generationConfig)).toContain('artDirection');
    expect(result.content).toEqual({ artDirection: 'Traço limpo' });
  });

  it('gera conteúdo estruturado usando o schema da etapa', async () => {
    queued.post.mockResolvedValueOnce({
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
      usage: {
        model: 'gemini-text-test',
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      },
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
    const sent = JSON.parse(contents[0].parts[0].text) as Record<
      string,
      unknown
    >;
    // The editorial prompt is an instruction: it travels in the system prompt.
    expect(sent).not.toHaveProperty('adminPrompt');
    const system = JSON.stringify(body.systemInstruction);
    expect(system).toContain('PROMPT EDITORIAL DA ETAPA');
    expect(system).toContain('Nunca copie essas descrições para story');
    expect(options.feature).toBe(AiQueueFeature.LESSONS);
    expect(options).not.toHaveProperty('headers');
  });

  it.each(['MAX_TOKENS', 'RECITATION', 'SAFETY'])(
    'rejeita texto com término %s mesmo quando o JSON é válido',
    async (finishReason) => {
      queued.post.mockResolvedValue({
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
      // A safety block would repeat on the fallback model: it is not spent.
      expect(queued.post.mock.calls).toHaveLength(
        finishReason === 'SAFETY' ? 1 : 2,
      );
    },
  );

  it('usa o fallback configurado quando a resposta principal foi interrompida', async () => {
    queued.post.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            finishReason: 'MAX_TOKENS',
            content: { parts: [{ text: '{"title":"Parcial"}' }] },
          },
        ],
      },
    });
    queued.post.mockResolvedValueOnce({
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
    queued.post.mockResolvedValueOnce({
      data: {
        id: 'image-1',
        outputImage: {
          data: pngImageFixture('jpeg-content').toString('base64'),
          mimeType: 'image/jpeg',
        },
      },
    });

    const result = await provider.generateImage(
      'Uma cena bíblica infantil',
      'PORTRAIT',
      'INTERACTIVE_COLORING',
    );

    expect(result.equals(pngImageFixture('jpeg-content'))).toBe(true);
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
    expect(options.feature).toBe(AiQueueFeature.LESSONS);
    expect(options).not.toHaveProperty('headers');
  });

  it('envia a imagem-mãe junto do prompt das cenas seguintes', async () => {
    queued.post.mockResolvedValueOnce({
      data: {
        outputImage: {
          data: pngImageFixture('next-scene').toString('base64'),
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

  it('anexa todas as imagens de referência de uma substituição', async () => {
    queued.post.mockResolvedValueOnce({
      data: {
        outputImage: {
          data: pngImageFixture('replacement').toString('base64'),
          mimeType: 'image/png',
        },
      },
    });

    await provider.generateImage('Imagem refeita', 'LANDSCAPE', 'CUTOUT_KIT', {
      data: Buffer.from('identity-reference'),
      mimeType: 'image/png',
      companions: [{ data: Buffer.from('neighbour'), mimeType: 'image/jpeg' }],
    });

    const [, body] = lastPostCall();
    expect(body.input).toEqual([
      expect.objectContaining({ type: 'text' }),
      {
        type: 'image',
        data: Buffer.from('identity-reference').toString('base64'),
        mime_type: 'image/png',
      },
      {
        type: 'image',
        data: Buffer.from('neighbour').toString('base64'),
        mime_type: 'image/jpeg',
      },
    ]);
  });

  it('repete a chamada quando o Gemini responde com erro transitório', async () => {
    values.GEMINI_MAX_RETRIES = '1';
    queued.post
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
    expect(queued.post.mock.calls).toHaveLength(2);
    expect(queued.post.mock.calls[1][0]).toContain(
      '/models/gemini-text-test:generateContent',
    );
  });

  it('não repete quando o Free Tier possui cota diária zero', async () => {
    values.GEMINI_MAX_RETRIES = '3';
    queued.post.mockRejectedValueOnce({
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
    expect(queued.post.mock.calls).toHaveLength(1);
  });

  it('usa o modelo fallback após esgotar o modelo principal', async () => {
    queued.post
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
    expect(queued.post.mock.calls[1][0]).toContain(
      '/models/gemini-text-fallback-test:generateContent',
    );
  });

  it('recusa geração quando a chave Gemini não está configurada', async () => {
    const missingConfig = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const missingProvider = new GeminiLessonLlmProvider(
      missingConfig,
      queued.service,
    );

    await expect(
      missingProvider.generateImage('imagem'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(queued.post.mock.calls).toHaveLength(0);
  });

  const lessonInput = {
    theme: 'Teste',
    biblicalReference: 'João 3:16',
    weekNumber: 1,
    stage: LessonStageType.LESSON,
    template: LESSON_TEMPLATES[LessonStageType.LESSON],
    approvedUpstream: null,
    adminPrompt: '',
  };
  const httpError = (
    status: number,
    providerStatus: string,
    headers: Record<string, string> = {},
    code?: string,
  ): AxiosError =>
    Object.assign(new AxiosError('O provedor não concluiu.', code), {
      response: {
        status,
        statusText: '',
        headers,
        config: { headers: {} } as never,
        data: {
          error: { status: providerStatus, message: 'raw private text' },
        },
      },
    }) as AxiosError;

  it('não repete imagem em 5xx ambíguo para não cobrar duas vezes', async () => {
    values.GEMINI_MAX_RETRIES = '3';
    queued.post.mockRejectedValue(httpError(500, 'INTERNAL'));
    await expect(provider.generateImage('imagem')).rejects.toThrow(
      '"code":"api_error"',
    );
    expect(queued.post.mock.calls).toHaveLength(1);
  });

  it('não dorme além do teto quando o servidor pede uma espera longa', async () => {
    values.GEMINI_MAX_RETRIES = '3';
    queued.post.mockRejectedValue(
      httpError(429, 'RESOURCE_EXHAUSTED', { 'retry-after': '3600' }),
    );
    await expect(provider.generateImage('imagem')).rejects.toThrow(
      '"code":"RESOURCE_EXHAUSTED"',
    );
    expect(queued.post.mock.calls).toHaveLength(1);
  });

  it.each([
    [401, 'UNAUTHENTICATED', undefined, 'authentication'],
    [503, 'UNAVAILABLE', undefined, 'service_unavailable'],
    [400, 'INVALID_ARGUMENT', undefined, 'invalid_request'],
    [403, 'PERMISSION_DENIED', undefined, 'PERMISSION_DENIED'],
    [504, 'DEADLINE_EXCEEDED', 'ETIMEDOUT', 'deadline_exceeded'],
  ])(
    'classifica HTTP %s %s sem repassar o texto do provedor',
    async (status, providerStatus, code, expected) => {
      queued.post.mockRejectedValue(
        httpError(status, providerStatus, {}, code),
      );
      const failure: unknown = await provider
        .generateStage(lessonInput)
        .catch((error: unknown) => error);
      const message = failure instanceof Error ? failure.message : '';
      expect(message).toContain(`"code":"${expected}"`);
      expect(message).not.toContain('raw private text');
    },
  );

  it('informa o consumo de tokens e o modelo realmente usado', async () => {
    queued.post
      .mockRejectedValueOnce(httpError(503, 'UNAVAILABLE'))
      .mockResolvedValueOnce({
        data: {
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
          usageMetadata: {
            promptTokenCount: 120,
            candidatesTokenCount: 30,
            totalTokenCount: 150,
          },
        },
      });
    await expect(provider.generateStage(lessonInput)).resolves.toMatchObject({
      usage: {
        model: 'gemini-text-fallback-test',
        inputTokens: 120,
        outputTokens: 30,
        totalTokens: 150,
      },
    });
  });

  it('rejeita JSON malformado e bytes que não são imagem', async () => {
    queued.post.mockResolvedValue({
      data: { candidates: [{ content: { parts: [{ text: '{"cut":' }] } }] },
    });
    await expect(provider.generateStage(lessonInput)).rejects.toThrow(
      'JSON malformado',
    );
    queued.post.mockResolvedValue({
      data: {
        outputImage: { data: Buffer.from('<html>').toString('base64') },
      },
    });
    await expect(provider.generateImage('imagem')).rejects.toThrow(
      'não é uma imagem PNG ou JPEG válida',
    );
  });
});
