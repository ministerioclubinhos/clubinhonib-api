import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OpenAiLessonService } from './open-ai-lesson.service';

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
