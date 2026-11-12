import { pngImageFixture } from '../fixtures/provider-image.fixture';
import { createAiQueueMock } from 'src/shared/providers/ai-queue/testing/queue.mock';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { OpenAiLessonService, schemaFor } from './open-ai-lesson.service';
import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';
import { LESSON_BASE_PROMPT } from '../constants/lesson-editorial.constants';

const queued = createAiQueueMock();

describe('OpenAiLessonService image identity', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        OPENAI_API_KEY: 'test-key',
        OPENAI_IMAGE_MODEL: 'gpt-image-test',
        OPENAI_IMAGE_QUALITY: 'high',
      };
      return values[key];
    }),
  };
  const service = new OpenAiLessonService(
    config as unknown as ConfigService,
    queued.service,
  );

  beforeEach(() => queued.post.mockReset());

  it('reviews the real artwork with a separate schema and keeps administrator instructions out of the reviewer', async () => {
    queued.post.mockResolvedValue({
      data: { id: 'review-response', output_text: '{"issues":[]}' },
    });
    await service.generateStage({
      theme: 'Tema livre',
      biblicalReference: 'Referência aprovada',
      weekNumber: 1,
      stage: LessonStageType.MEDITATION_OLDER,
      template: LESSON_TEMPLATES[LessonStageType.MEDITATION_OLDER],
      approvedUpstream: { story: 'Fonte aprovada.' },
      adminPrompt: 'Instrução de geração',
      olderMeditationReview: {
        content: { activities: [] },
        images: [
          {
            activityNumber: 2,
            image: { data: Buffer.from('actual-image'), mimeType: 'image/png' },
          },
        ],
      },
    });
    const body = queued.post.mock.lastCall?.[1] as {
      input: Array<{ content: unknown }>;
      text: { format: { schema: { required: string[] } } };
    };
    expect(body.input[0].content).toContain('revisor independente');
    expect(JSON.stringify(body.input[1].content)).toContain('input_image');
    expect(JSON.stringify(body.input[1].content)).toContain(
      Buffer.from('actual-image').toString('base64'),
    );
    expect(JSON.stringify(body.input[1].content)).not.toContain(
      'Instrução de geração',
    );
    expect(body.text.format.schema.required).toEqual(['issues']);
  });

  it('limits older gpt-4o output reservation without changing other stage requests', async () => {
    const instance = new OpenAiLessonService(
      {
        get: <T>(key: string) =>
          (key === 'OPENAI_TEXT_MODEL'
            ? 'gpt-4o'
            : key === 'OPENAI_API_KEY'
              ? 'test-key'
              : undefined) as T | undefined,
      },
      queued.service,
    );
    queued.post.mockResolvedValue({
      data: { id: 'test-response', output_text: '{}' },
    });
    for (const stage of [
      LessonStageType.MEDITATION_OLDER,
      LessonStageType.MEDITATION_YOUNGER,
    ]) {
      await instance.generateStage({
        theme: 'Jesus vive',
        biblicalReference: 'João 11',
        weekNumber: 14,
        stage,
        template: LESSON_TEMPLATES[stage],
        approvedUpstream: null,
        adminPrompt: '',
      });
      const payload = queued.post.mock.lastCall?.[1] as Record<string, unknown>;
      // Every stage is bounded on models without reasoning; item 7 keeps its own cap.
      expect(payload.max_output_tokens).toBe(
        stage === LessonStageType.MEDITATION_OLDER ? 4096 : 8000,
      );
    }
  });

  it('requires complete printable older blocks without changing the younger schema', () => {
    expect(
      JSON.stringify(schemaFor(LessonStageType.MEDITATION_OLDER)),
    ).toContain('sourceExcerpt');
    expect(
      JSON.stringify(schemaFor(LessonStageType.MEDITATION_YOUNGER)),
    ).not.toContain('sourceExcerpt');
  });

  it.each([
    ['gpt-4o', 'none', false],
    ['gpt-4o', 'high', false],
    ['gpt-4o-2024-08-06', 'low', false],
    ['gpt-4o-mini', 'none', false],
    ['gpt-4.1', 'high', false],
    ['gpt-5.4', 'high', true],
    ['gpt-6-luna', 'none', true],
    ['o3-mini', 'low', true],
    ['o1', 'medium', true],
    ['gpt-5.4', undefined, false],
    ['gpt-5-chat-latest', 'low', false],
  ])(
    'respeita o suporte a raciocínio de %s com esforço %s',
    async (model, effort, supported) => {
      const stageService = new OpenAiLessonService(
        {
          get: <T>(key: string): T | undefined => {
            const values: Record<string, string | undefined> = {
              OPENAI_API_KEY: 'test-key',
              OPENAI_TEXT_MODEL: model,
              OPENAI_REASONING_EFFORT: effort,
            };
            return values[key] as T | undefined;
          },
        },
        queued.service,
      );
      queued.post.mockResolvedValueOnce({
        data: { id: 'meditation-response', output_text: '{}' },
      });

      await stageService.generateStage({
        theme: 'O poder de Jesus sobre a morte',
        biblicalReference: 'João 11:1-44; Lucas 7:11-17',
        weekNumber: 14,
        stage: LessonStageType.MEDITATION_YOUNGER,
        template: LESSON_TEMPLATES[LessonStageType.MEDITATION_YOUNGER],
        approvedUpstream: null,
        adminPrompt: 'Meditação para crianças menores',
      });

      const body: unknown = queued.post.mock.lastCall?.[1];
      expect(body).toMatchObject({ model, store: false });
      if (supported) {
        expect(body).toHaveProperty('reasoning', { effort });
      } else {
        expect(body).not.toHaveProperty('reasoning');
      }
      expect(queued.post.mock.calls).toHaveLength(1);
    },
  );

  it('envia o padrão editorial e um contrato compatível com oito perguntas e oração vazia', async () => {
    const generated = {
      story: 'Crianças, vocês já tiveram uma dúvida? (aguarde as respostas)',
      closingPrayer: '',
      reviewQuestions: Array.from({ length: 8 }, () => ({
        question: 'Por quê?',
        answer: 'Por amor.',
      })),
      visualScenes: [{ id: 'scene-01', prompt: 'Cena separada.' }],
    };
    queued.post.mockResolvedValueOnce({
      data: {
        id: 'editorial-response',
        output_text: JSON.stringify(generated),
      },
    });
    const result = await service.generateStage({
      theme: 'Ressurreição, ascensão de Jesus e a grande comissão.',
      biblicalReference: 'João 20:19-31',
      weekNumber: 26,
      stage: LessonStageType.LESSON,
      template: LESSON_TEMPLATES[LessonStageType.LESSON],
      approvedUpstream: null,
      adminPrompt: LESSON_BASE_PROMPT,
    });
    expect(result.content).toEqual(generated);
    const body = queued.post.mock.lastCall?.[1] as {
      input: Array<{ role: string; content: string }>;
      text: { format: { schema: Record<string, unknown> } };
    };
    const user = JSON.parse(
      body.input.find((item) => item.role === 'user')?.content ?? '{}',
    ) as { adminPrompt: string };
    expect(user.adminPrompt).toContain('Não omita Tomé');
    expect(body.text.format.schema).toEqual(schemaFor(LessonStageType.LESSON));
    expect(body.text.format.schema).toMatchObject({
      properties: {
        reviewQuestions: { minItems: 8, maxItems: 10 },
        closingPrayer: { type: 'string' },
      },
    });
  });

  it('retries a reset image request without regenerating text', async () => {
    jest.useFakeTimers();
    queued.post
      .mockRejectedValueOnce(
        Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
      )
      .mockResolvedValueOnce({
        data: {
          data: [{ b64_json: pngImageFixture('recovered').toString('base64') }],
        },
      });
    try {
      const pending = service.generateImage('Desenho aprovado');
      await jest.runAllTimersAsync();
      expect((await pending).equals(pngImageFixture('recovered'))).toBe(true);
      expect(queued.post.mock.calls).toHaveLength(2);
      expect(queued.post.mock.calls.map((call) => call[0])).toEqual([
        'https://api.openai.com/v1/images/generations',
        'https://api.openai.com/v1/images/generations',
      ]);
      expect(queued.post.mock.calls[0][1]).toEqual(
        queued.post.mock.calls[1][1],
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('usa edição com a imagem-mãe nas cenas seguintes', async () => {
    queued.post.mockResolvedValueOnce({
      data: {
        data: [{ b64_json: pngImageFixture('next-scene').toString('base64') }],
      },
    });

    const result = await service.generateImage(
      'Cena seguinte',
      'LANDSCAPE',
      'STORY_SEQUENCE',
      {
        data: Buffer.from('identity-reference'),
        mimeType: 'image/png',
      },
    );

    expect(result.equals(pngImageFixture('next-scene'))).toBe(true);
    const call = queued.post.mock.lastCall;
    expect(call?.[0]).toBe('https://api.openai.com/v1/images/edits');
    expect(call?.[1]).toBeInstanceOf(FormData);
    const form = call?.[1] as FormData;
    expect(form.get('prompt')).toContain('Cena seguinte');
    expect(form.get('image[]')).toBeInstanceOf(Blob);
  });

  it('anexa todas as imagens de referência de uma substituição', async () => {
    queued.post.mockResolvedValueOnce({
      data: {
        data: [{ b64_json: pngImageFixture('replacement').toString('base64') }],
      },
    });

    await service.generateImage('Imagem refeita', 'LANDSCAPE', 'CUTOUT_KIT', {
      data: Buffer.from('identity-reference'),
      mimeType: 'image/png',
      companions: [
        { data: Buffer.from('neighbour-a'), mimeType: 'image/png' },
        { data: Buffer.from('neighbour-b'), mimeType: 'image/jpeg' },
      ],
    });

    const form = queued.post.mock.lastCall?.[1] as FormData;
    const files = form.getAll('image[]') as File[];
    expect(files).toHaveLength(3);
    expect(files.map((file) => file.type)).toEqual([
      'image/png',
      'image/png',
      'image/jpeg',
    ]);
  });

  const textService = (model: string, effort?: string) =>
    new OpenAiLessonService(
      {
        get: <T>(key: string): T | undefined =>
          ({
            OPENAI_API_KEY: 'test-key',
            OPENAI_TEXT_MODEL: model,
            OPENAI_REASONING_EFFORT: effort,
          })[key] as T | undefined,
      },
      queued.service,
    );
  const lessonInput = {
    theme: 'Jesus vive',
    biblicalReference: 'João 11',
    weekNumber: 14,
    stage: LessonStageType.LESSON,
    template: LESSON_TEMPLATES[LessonStageType.LESSON],
    approvedUpstream: null,
    adminPrompt: '',
  };

  it('detects refusal blocks instead of reporting an empty answer', async () => {
    queued.post.mockResolvedValue({
      data: {
        id: 'refused',
        output: [{ content: [{ type: 'refusal', refusal: 'I cannot help.' }] }],
      },
    });
    await expect(
      textService('gpt-4o').generateStage(lessonInput),
    ).rejects.toThrow('"code":"content_blocked"');
  });

  it('classifies timeouts and never forwards them as an unknown failure', async () => {
    queued.post.mockRejectedValue(
      new AxiosError('timeout of 120000ms exceeded', 'ECONNABORTED'),
    );
    await expect(
      textService('gpt-4o').generateStage(lessonInput),
    ).rejects.toThrow('"code":"deadline_exceeded"');
  });

  it('omits the `none` effort for o-series and bounds output only without reasoning', async () => {
    queued.post.mockResolvedValue({
      data: {
        id: 'ok',
        output_text: '{}',
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      },
    });
    await expect(
      textService('o3-mini', 'none').generateStage(lessonInput),
    ).resolves.toMatchObject({
      usage: { model: 'o3-mini', inputTokens: 10, outputTokens: 5 },
    });
    const reasoning = queued.post.mock.lastCall?.[1] as Record<string, unknown>;
    expect(reasoning).not.toHaveProperty('reasoning');
    expect(reasoning).not.toHaveProperty('max_output_tokens');

    await textService('gpt-4o').generateStage(lessonInput);
    expect(queued.post.mock.lastCall?.[1]).toMatchObject({
      max_output_tokens: 12000,
    });
  });

  it('retries a rate limit on every stage and rejects bytes that are not an image', async () => {
    jest.useFakeTimers();
    try {
      queued.post
        .mockRejectedValueOnce(
          Object.assign(new AxiosError('rate limited'), {
            response: {
              status: 429,
              headers: { 'retry-after': '1' },
              data: { error: { code: 'rate_limit_exceeded' } },
            },
          }),
        )
        .mockResolvedValueOnce({ data: { id: 'ok', output_text: '{}' } });
      const pending = textService('gpt-4o').generateStage(lessonInput);
      await jest.runAllTimersAsync();
      await expect(pending).resolves.toMatchObject({ responseId: 'ok' });
      expect(queued.post.mock.calls).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
    queued.post.mockResolvedValue({
      data: {
        data: [{ b64_json: Buffer.from('not an image').toString('base64') }],
      },
    });
    await expect(service.generateImage('Desenho')).rejects.toThrow(
      'não é uma imagem PNG ou JPEG válida',
    );
  });

  it('bounds the number of game steps, one paid image each', () => {
    for (const stage of [
      LessonStageType.STANDARD_GAME,
      LessonStageType.VERSE_FIXATION,
    ]) {
      const schema = schemaFor(stage) as {
        properties: Record<string, { maxItems?: number }>;
      };
      expect(schema.properties.steps.maxItems).toBe(8);
      expect(schema.properties.assets.maxItems).toBe(8);
    }
  });
});
