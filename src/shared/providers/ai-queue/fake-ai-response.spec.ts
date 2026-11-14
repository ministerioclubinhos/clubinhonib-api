import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { AiProviderTransportProvider } from './ai-provider-transport.provider';
import {
  extractSourceData,
  fakeAiResponse,
  fakeFromSchema,
  resolveAiProviderMode,
} from './fake-ai-response.utils';
import {
  AiProviderMode,
  AiQueueBodyKind,
  AiQueueFeature,
  AiQueueMethod,
  AiQueueProviderName,
} from './enums';
import { AI_FAKE_PNG_BASE64, AI_FAKE_TEXT } from './constants';
import { AiQueueRequest } from './types';
import {
  IDEA_JUDGE_SCHEMA,
  IDEA_TEXT_SCHEMA,
} from 'src/modules/pages/ideas-section-ai/schemas';

jest.mock('axios');
const httpRequest = jest.spyOn(axios, 'request');

const source = { title: 'Gincana', description: 'Separe 3 bolas.' };
const sourceText = `SOURCE_DATA\n${JSON.stringify(source)}\nEND_SOURCE_DATA`;

const request = (overrides: Partial<AiQueueRequest>): AiQueueRequest => ({
  provider: AiQueueProviderName.OPENAI,
  feature: AiQueueFeature.SHARED_IDEAS,
  method: AiQueueMethod.POST,
  url: 'https://api.openai.com/v1/responses',
  body: { kind: AiQueueBodyKind.JSON, json: {} },
  expiresAt: Date.now() + 5000,
  timeoutMs: 1000,
  maxContentLength: 1024,
  ...overrides,
});

describe('AI provider mode', () => {
  it('fake only outside production', () => {
    expect(resolveAiProviderMode('fake', 'development')).toBe(
      AiProviderMode.FAKE,
    );
    expect(resolveAiProviderMode('fake', undefined)).toBe(AiProviderMode.FAKE);
    expect(resolveAiProviderMode('fake', 'production')).toBe(
      AiProviderMode.LIVE,
    );
    expect(resolveAiProviderMode(undefined, 'development')).toBe(
      AiProviderMode.LIVE,
    );
    expect(resolveAiProviderMode('qualquer', 'test')).toBe(AiProviderMode.LIVE);
  });

  it('the fake transport never reaches the network nor reads the key', async () => {
    const settings = {
      getInternalOpenAiSettings: jest.fn(),
      getInternalGeminiSettings: jest.fn(),
    };
    const transport = new AiProviderTransportProvider(
      settings as unknown as GetAiProviderSettingsService,
      {
        get: (key: string) =>
          key === 'AI_PROVIDER_MODE' ? 'fake' : 'development',
      } as unknown as ConfigService,
    );
    expect(transport.mode).toBe(AiProviderMode.FAKE);
    const response = await transport.execute(request({}));
    expect(response.status).toBe(200);
    expect(response.headers['x-ai-provider-mode']).toBe('fake');
    expect(httpRequest).not.toHaveBeenCalled();
    expect(settings.getInternalOpenAiSettings).not.toHaveBeenCalled();
  });

  it('keeps refusing endpoints outside the allow-list', async () => {
    const transport = new AiProviderTransportProvider(
      {} as GetAiProviderSettingsService,
      { get: () => 'fake' } as unknown as ConfigService,
    );
    await expect(
      transport.execute(request({ url: 'https://evil.example/v1/responses' })),
    ).rejects.toBeDefined();
  });
});

describe('fake AI responses', () => {
  it('echoes source fields so an "enhancement" equals the original', () => {
    const response = fakeAiResponse(
      request({
        body: {
          kind: AiQueueBodyKind.JSON,
          json: {
            input: [
              {
                role: 'user',
                content: [{ type: 'input_text', text: sourceText }],
              },
            ],
            text: { format: { type: 'json_schema', schema: IDEA_TEXT_SCHEMA } },
          },
        },
      }),
    );
    const data = response.data as {
      output: Array<{ content: Array<{ text: string }> }>;
    };
    expect(JSON.parse(data.output[0].content[0].text)).toMatchObject(source);
  });

  it('the judge approves; booleans follow the conservative overrides', () => {
    expect(fakeFromSchema(IDEA_JUDGE_SCHEMA, {})).toMatchObject({
      preservesEssence: true,
      violations: [],
    });
    expect(
      fakeFromSchema({
        type: 'object',
        properties: {
          containsPeople: { type: 'boolean' },
          hasEssentialVisuals: { type: 'boolean' },
          other: { type: 'boolean' },
        },
      }),
    ).toEqual({
      containsPeople: true,
      hasEssentialVisuals: true,
      other: false,
    });
  });

  it('fills every schema kind deterministically', () => {
    expect(
      fakeFromSchema({
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['photo', 'drawing'] },
          count: { type: 'integer', minimum: 2 },
          tags: { type: 'array', items: { type: 'string' }, minItems: 2 },
          note: { type: ['string', 'null'] },
          choice: { anyOf: [{ type: 'null' }, { type: 'number' }] },
        },
      }),
    ).toEqual({
      kind: 'photo',
      count: 2,
      tags: [AI_FAKE_TEXT, AI_FAKE_TEXT],
      note: AI_FAKE_TEXT,
      choice: 0,
    });
    expect(fakeFromSchema(undefined)).toBe(AI_FAKE_TEXT);
  });

  it('extracts SOURCE_DATA from any string of the body, ignoring non-JSON', () => {
    expect(extractSourceData({ parts: [{ text: sourceText }] })).toEqual(
      source,
    );
    expect(extractSourceData({ text: 'SOURCE_DATA\nnão é json' })).toEqual({});
    expect(extractSourceData(null)).toEqual({});
  });

  it('answers images, model lists and Gemini in the provider format', () => {
    expect(
      fakeAiResponse(request({ url: 'https://api.openai.com/v1/images/edits' }))
        .data,
    ).toEqual({ data: [{ b64_json: AI_FAKE_PNG_BASE64 }] });
    expect(
      fakeAiResponse(
        request({
          method: AiQueueMethod.GET,
          url: 'https://api.openai.com/v1/models',
        }),
      ).data,
    ).toMatchObject({
      data: [{ id: 'fake-text-model' }, { id: 'fake-image-model' }],
    });
    const gemini = request({
      provider: AiQueueProviderName.GEMINI,
      url: 'https://generativelanguage.googleapis.com/v1beta/models/x:generateContent',
      body: {
        kind: AiQueueBodyKind.JSON,
        json: {
          contents: [{ parts: [{ text: sourceText }] }],
          generationConfig: { responseJsonSchema: IDEA_TEXT_SCHEMA },
        },
      },
    });
    const text = (
      fakeAiResponse(gemini).data as {
        candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      }
    ).candidates[0].content.parts[0].text;
    expect(JSON.parse(text)).toMatchObject(source);
    const image = fakeAiResponse({
      ...gemini,
      body: {
        kind: AiQueueBodyKind.JSON,
        json: { generationConfig: { responseModalities: ['IMAGE'] } },
      },
    }).data as {
      candidates: Array<{
        content: { parts: Array<{ inlineData: { data: string } }> };
      }>;
    };
    expect(image.candidates[0].content.parts[0].inlineData.data).toBe(
      AI_FAKE_PNG_BASE64,
    );
    expect(
      fakeAiResponse(
        request({
          provider: AiQueueProviderName.GEMINI,
          method: AiQueueMethod.GET,
          url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
        }),
      ).data,
    ).toMatchObject({ models: [{ name: 'models/fake-text-model' }, {}] });
  });
});
