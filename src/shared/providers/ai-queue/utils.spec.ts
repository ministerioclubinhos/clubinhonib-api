import { AxiosError, AxiosHeaders } from 'axios';
import {
  AiQueueBodyKind,
  AiQueueFailure,
  AiQueueMethod,
  AiQueueProviderName,
} from './enums';
import {
  aiQueueEndpoint,
  redisConnection,
  restoreAiBody,
  aiBodyBytes,
  aiQueuePath,
  restoreAiError,
  serializeAiBody,
  serializeAiError,
} from './utils';

import { AiQueueException } from './ai-queue.exception';

describe('AI queue serialization and boundaries', () => {
  it('keeps older meditation delay and wrapped image connection retries after sanitization', () => {
    const error = restoreAiError(
      serializeAiError({
        cause: { code: 'ECONNRESET' },
        response: {
          status: 429,
          data: {
            error: {
              code: 'slow_down',
              message: 'private prompt; try again in 3.5s',
            },
          },
        },
      }),
    );
    expect(error.code).toBe('ECONNRESET');
    expect(error.response?.headers['retry-after']).toBe('3.5');
    expect(error.response?.data).toMatchObject({
      error: { code: 'slow_down' },
    });
    expect(JSON.stringify(error.response?.data)).not.toContain(
      'private prompt',
    );
  });
  it('round-trips image multipart bytes, repeated fields and metadata', async () => {
    const body = new FormData();
    body.append('model', 'image-model');
    body.append(
      'image[]',
      new Blob([new Uint8Array([0, 255, 10, 23])], { type: 'image/png' }),
      'reference.png',
    );
    body.append('image[]', new Blob(['second']), 'second.png');
    const encoded = await serializeAiBody(body);
    const restored = restoreAiBody(
      JSON.parse(JSON.stringify(encoded)) as typeof encoded,
    ) as FormData;
    expect(restored.get('model')).toBe('image-model');
    expect(restored.getAll('image[]')).toHaveLength(2);
    const image = restored.get('image[]') as File;
    expect(image.name).toBe('reference.png');
    expect(image.type).toBe('image/png');
    expect(Buffer.from(await image.arrayBuffer())).toEqual(
      Buffer.from([0, 255, 10, 23]),
    );
  });

  it.each([
    [
      'https://api.openai.com/v1/responses',
      AiQueueMethod.POST,
      AiQueueProviderName.OPENAI,
    ],
    [
      'https://api.openai.com/v1/images/generations',
      AiQueueMethod.POST,
      AiQueueProviderName.OPENAI,
    ],
    [
      'https://api.openai.com/v1/images/edits',
      AiQueueMethod.POST,
      AiQueueProviderName.OPENAI,
    ],
    [
      'https://api.openai.com/v1/models',
      AiQueueMethod.GET,
      AiQueueProviderName.OPENAI,
    ],
    [
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      AiQueueMethod.POST,
      AiQueueProviderName.GEMINI,
    ],
    [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
      AiQueueMethod.POST,
      AiQueueProviderName.GEMINI,
    ],
  ])('allows the supported provider endpoint %s', (url, method, provider) => {
    expect(aiQueueEndpoint(url, method)).toEqual({ url, provider });
  });

  it.each([
    'http://api.openai.com/v1/responses',
    'https://api.openai.com.evil.test/v1/responses',
    'https://key@api.openai.com/v1/responses',
    'https://api.openai.com/v1/responses?api_key=secret',
    'https://127.0.0.1/v1/responses',
    'https://api.openai.com/v1/files',
    'https://api.openai.com:8443/v1/responses',
    'invalid',
  ])('rejects unsafe endpoint %s', (url) => {
    expect(() => aiQueueEndpoint(url, AiQueueMethod.POST)).toThrow();
  });

  it('preserves retry signals but removes provider secrets and arbitrary error contents', () => {
    const original = new AxiosError(
      'secret prompt',
      'ECONNRESET',
      undefined,
      undefined,
      {
        status: 429,
        statusText: '',
        config: { headers: new AxiosHeaders({ Authorization: 'secret-key' }) },
        headers: { 'retry-after': '5', authorization: 'secret-key' },
        data: {
          error: { code: 'rate_limit_exceeded', message: 'secret prompt' },
        },
      },
    );
    const serialized = serializeAiError(original);
    expect(JSON.stringify(serialized)).not.toContain('secret');
    const restored = restoreAiError(serialized);
    expect(restored).toBeInstanceOf(AxiosError);
    expect(restored.code).toBe('ECONNRESET');
    expect(restored.response).toMatchObject({
      status: 429,
      headers: { 'retry-after': '5' },
      data: { error: { code: 'rate_limit_exceeded' } },
    });
  });

  it('preserves non-retryable Gemini free-tier zero quota without retaining raw messages', () => {
    const result = serializeAiError({
      response: {
        status: 429,
        data: { message: 'Free tier: limit 0 requests per day. key=secret' },
      },
    });
    expect(result.freeTierQuota).toBe(true);
    expect(JSON.stringify(restoreAiError(result).response?.data)).toContain(
      '0 requests per day',
    );
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('parses Redis TLS/auth/db without echoing malformed credential URLs', () => {
    expect(
      redisConnection('rediss://user:pass%40word@redis.test:6380/2'),
    ).toMatchObject({
      host: 'redis.test',
      port: 6380,
      db: 2,
      username: 'user',
      password: 'pass@word',
      tls: {},
    });
    expect(() => redisConnection('https://secret@example.test')).toThrow(
      'REDIS_URL inválida.',
    );
  });

  it('keeps the Gemini canonical status so failures stay classifiable', () => {
    const restored = restoreAiError(
      serializeAiError({
        response: {
          status: 429,
          data: {
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'quota for key=secret',
            },
          },
        },
      }),
    );
    expect(restored.response?.data).toMatchObject({
      error: { status: 'RESOURCE_EXHAUSTED' },
    });
    expect(JSON.stringify(restored.response?.data)).not.toContain('secret');
  });

  it.each([
    'invalid_api_key',
    'credit_balance_exhausted',
    'organization_spend_limit_exceeded',
    'moderation_blocked',
    'server_is_overloaded',
  ])('keeps the OpenAI code %s consumed by the Studio', (code) => {
    const serialized = serializeAiError({
      response: {
        status: 400,
        data: { error: { code, type: 'authentication_error' } },
      },
    });
    expect(serialized).toMatchObject({
      providerCode: code,
      type: 'authentication_error',
    });
  });

  it('drops unknown provider identifiers and carries queue failures', () => {
    expect(
      serializeAiError({
        response: { status: 400, data: { error: { code: 'leak-me' } } },
      }).providerCode,
    ).toBeUndefined();
    expect(
      serializeAiError(new AiQueueException(AiQueueFailure.CREDENTIAL_MISSING)),
    ).toMatchObject({ queueFailure: AiQueueFailure.CREDENTIAL_MISSING });
  });

  it('measures payloads without serializing the whole job again', () => {
    expect(
      aiBodyBytes({
        kind: AiQueueBodyKind.MULTIPART,
        parts: [{ name: 'image[]', base64: 'QUJD', mimeType: 'image/png' }],
      }),
    ).toBeGreaterThanOrEqual(4);
    expect(aiQueuePath('https://api.openai.com/v1/responses')).toBe(
      '/v1/responses',
    );
  });
});
