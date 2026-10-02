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
