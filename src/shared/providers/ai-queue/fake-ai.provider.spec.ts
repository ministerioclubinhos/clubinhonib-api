import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AiQueueBodyKind,
  AiQueueFeature,
  AiQueueMethod,
  AiQueueProviderName,
} from './enums';
import { AI_FAKE_INVALID_JSON, AI_FAKE_REWRITE_TEXT } from './constants';
import { FakeAiProvider } from './fake-ai.provider';
import { AiQueueRequest } from './types';
import { serializeAiError } from './utils';

const schema = {
  type: 'object',
  properties: { title: { type: 'string' } },
};

const request = (
  marker: string,
  provider = AiQueueProviderName.OPENAI,
): AiQueueRequest => {
  const source = `SOURCE_DATA\n${JSON.stringify({ title: `Gincana ${marker}` })}\nEND_SOURCE_DATA`;
  const openai = provider === AiQueueProviderName.OPENAI;
  return {
    provider,
    feature: AiQueueFeature.SHARED_IDEAS,
    method: AiQueueMethod.POST,
    url: openai
      ? 'https://api.openai.com/v1/responses'
      : 'https://generativelanguage.googleapis.com/v1beta/models/m:generateContent',
    body: {
      kind: AiQueueBodyKind.JSON,
      json: openai
        ? { input: [{ content: source }], text: { format: { schema } } }
        : {
            contents: [{ parts: [{ text: source }] }],
            generationConfig: { responseJsonSchema: schema },
          },
    },
    expiresAt: Date.now() + 60_000,
    timeoutMs: 1000,
    maxContentLength: 1024,
  };
};

interface OpenAiData {
  status: string;
  incomplete_details?: { reason: string };
  output: { content: { text: string }[] }[];
}

const textOf = (data: unknown): string =>
  (data as OpenAiData).output[0].content[0].text;

describe('FakeAiProvider', () => {
  const folder = mkdtempSync(join(tmpdir(), 'ai-fake-'));
  const journal = join(folder, 'journal.jsonl');
  const provider = new FakeAiProvider(journal, 1);

  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it('sem marcador responde no formato do provedor e registra o pedido', async () => {
    const response = await provider.respond(request(''));

    expect(JSON.parse(textOf(response.data))).toEqual({ title: 'Gincana ' });
    const last = readFileSync(journal, 'utf8').trim().split('\n').pop();
    expect(JSON.parse(last as string)).toMatchObject({
      feature: AiQueueFeature.SHARED_IDEAS,
      path: '/v1/responses',
      scenario: null,
    });
  });

  it.each([
    ['rate-limit', 429, 'rate_limit_exceeded'],
    ['quota', 429, 'insufficient_quota'],
    ['auth', 401, 'invalid_api_key'],
    ['server-error', 503, 'server_is_overloaded'],
    ['blocked', 400, 'content_policy_violation'],
  ])(
    '%s chega ao módulo como o erro do provedor',
    async (scenario, status, providerCode) => {
      const error: unknown = await provider
        .respond(request(`[[ai-fake:${scenario}]]`))
        .catch((value: unknown) => value);

      expect(serializeAiError(error)).toMatchObject({ status, providerCode });
    },
  );

  it('no Gemini o erro usa o status canônico', async () => {
    const error: unknown = await provider
      .respond(request('[[ai-fake:rate-limit]]', AiQueueProviderName.GEMINI))
      .catch((value: unknown) => value);

    expect(serializeAiError(error)).toMatchObject({
      status: 429,
      providerStatus: 'RESOURCE_EXHAUSTED',
    });
  });

  it.each([
    ['timeout', 'ECONNABORTED'],
    ['network', 'ECONNRESET'],
  ])('%s não tem resposta HTTP', async (scenario, code) => {
    const error: unknown = await provider
      .respond(request(`[[ai-fake:${scenario}]]`))
      .catch((value: unknown) => value);

    expect(serializeAiError(error)).toMatchObject({ code });
    expect(serializeAiError(error).status).toBeUndefined();
  });

  it('com número de vezes, falha e depois se recupera', async () => {
    const marker = '[[ai-fake:server-error:2#recupera]]';

    await expect(provider.respond(request(marker))).rejects.toBeDefined();
    await expect(provider.respond(request(marker))).rejects.toBeDefined();
    await expect(provider.respond(request(marker))).resolves.toMatchObject({
      status: 200,
    });
  });

  it('truncated marca a resposta como incompleta por limite de tokens', async () => {
    const { data } = await provider.respond(request('[[ai-fake:truncated]]'));

    expect(data).toMatchObject({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
    });
  });

  it('invalid-json devolve JSON quebrado e rewrite troca o texto', async () => {
    const broken = await provider.respond(request('[[ai-fake:invalid-json]]'));
    const rewritten = await provider.respond(request('[[ai-fake:rewrite]]'));

    expect(textOf(broken.data)).toBe(AI_FAKE_INVALID_JSON);
    expect(JSON.parse(textOf(rewritten.data))).toEqual({
      title: AI_FAKE_REWRITE_TEXT,
    });
  });

  it('polish só revisa o texto: nada é acrescentado nem trocado', async () => {
    const { data } = await provider.respond(request('[[ai-fake:polish#p]]'));

    // O marcador fica: a guarda reprovaria qualquer informação removida.
    expect(JSON.parse(textOf(data))).toEqual({
      title: 'Gincana [[ai-fake:polish#p]].',
    });
  });

  it('marcador desconhecido é ignorado', async () => {
    await expect(
      provider.respond(request('[[ai-fake:inexistente]]')),
    ).resolves.toMatchObject({ status: 200 });
  });
});
