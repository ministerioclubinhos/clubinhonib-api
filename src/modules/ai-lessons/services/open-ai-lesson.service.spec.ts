import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OpenAiLessonService, schemaFor } from './open-ai-lesson.service';
import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';
import { LESSON_BASE_PROMPT } from '../constants/lesson-editorial.constants';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

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
  const service = new OpenAiLessonService(config as unknown as ConfigService);

  beforeEach(() => mockedAxios.post.mockReset());

  it('reviews the real artwork with a separate schema and keeps administrator instructions out of the reviewer', async () => {
    mockedAxios.post.mockResolvedValue({
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
    const body = mockedAxios.post.mock.lastCall?.[1] as {
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
    const instance = new OpenAiLessonService({
      get: <T>(key: string) =>
        (key === 'OPENAI_TEXT_MODEL'
          ? 'gpt-4o'
          : key === 'OPENAI_API_KEY'
            ? 'test-key'
            : undefined) as T | undefined,
    });
    mockedAxios.post.mockResolvedValue({
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
      const payload = mockedAxios.post.mock.lastCall?.[1] as Record<
        string,
        unknown
      >;
      if (stage === LessonStageType.MEDITATION_OLDER)
        expect(payload.max_output_tokens).toBe(4096);
      else expect(payload).not.toHaveProperty('max_output_tokens');
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
      const stageService = new OpenAiLessonService({
        get: <T>(key: string): T | undefined => {
          const values: Record<string, string | undefined> = {
            OPENAI_API_KEY: 'test-key',
            OPENAI_TEXT_MODEL: model,
            OPENAI_REASONING_EFFORT: effort,
          };
          return values[key] as T | undefined;
        },
      });
      mockedAxios.post.mockResolvedValueOnce({
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

      const body: unknown = mockedAxios.post.mock.lastCall?.[1];
      expect(body).toMatchObject({ model, store: false });
      if (supported) {
        expect(body).toHaveProperty('reasoning', { effort });
      } else {
        expect(body).not.toHaveProperty('reasoning');
      }
      expect(mockedAxios.post.mock.calls).toHaveLength(1);
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
    mockedAxios.post.mockResolvedValueOnce({
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
    const body = mockedAxios.post.mock.lastCall?.[1] as {
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
    mockedAxios.post
      .mockRejectedValueOnce(
        Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
      )
      .mockResolvedValueOnce({
        data: {
          data: [{ b64_json: Buffer.from('recovered').toString('base64') }],
        },
      });
    try {
      const pending = service.generateImage('Desenho aprovado');
      await jest.runAllTimersAsync();
      expect((await pending).toString()).toBe('recovered');
      expect(mockedAxios.post.mock.calls).toHaveLength(2);
      expect(mockedAxios.post.mock.calls.map((call) => call[0])).toEqual([
        'https://api.openai.com/v1/images/generations',
        'https://api.openai.com/v1/images/generations',
      ]);
      expect(mockedAxios.post.mock.calls[0][1]).toEqual(
        mockedAxios.post.mock.calls[1][1],
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('usa edição com a imagem-mãe nas cenas seguintes', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: [{ b64_json: Buffer.from('next-scene').toString('base64') }],
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

    expect(result.toString()).toBe('next-scene');
    const call = mockedAxios.post.mock.lastCall;
    expect(call?.[0]).toBe('https://api.openai.com/v1/images/edits');
    expect(call?.[1]).toBeInstanceOf(FormData);
    const form = call?.[1] as FormData;
    expect(form.get('prompt')).toContain('Cena seguinte');
    expect(form.get('image[]')).toBeInstanceOf(Blob);
  });
});
