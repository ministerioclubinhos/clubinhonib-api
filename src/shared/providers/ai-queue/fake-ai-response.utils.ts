import {
  AI_FAKE_BOOLEANS,
  AI_FAKE_MODELS,
  AI_FAKE_PNG_BASE64,
  AI_FAKE_TEXT,
  AI_SOURCE_DATA_END,
  AI_SOURCE_DATA_START,
} from './constants';
import { AiProviderMode, AiQueueMethod, AiQueueProviderName } from './enums';
import { AiQueueRequest, AiQueueResponse } from './types';
import { restoreAiBody } from './utils';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `fake` só vale fora de produção: lá, o modo simulado quebraria a IA em silêncio. */
export function resolveAiProviderMode(
  value: string | undefined,
  nodeEnv: string | undefined,
): AiProviderMode {
  return value === String(AiProviderMode.FAKE) && nodeEnv !== 'production'
    ? AiProviderMode.FAKE
    : AiProviderMode.LIVE;
}

/** Primeiro bloco `SOURCE_DATA` encontrado no pedido, já como objeto. */
export function extractSourceData(body: unknown): JsonRecord {
  const text = JSON.stringify(body ?? null);
  const decoded: unknown = JSON.parse(text);
  const strings: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (isRecord(value)) Object.values(value).forEach(walk);
  };
  walk(decoded);
  for (const value of strings) {
    const start = value.indexOf(AI_SOURCE_DATA_START);
    if (start < 0) continue;
    const end = value.indexOf(AI_SOURCE_DATA_END, start);
    const raw = value.slice(
      start + AI_SOURCE_DATA_START.length,
      end < 0 ? undefined : end,
    );
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) return parsed;
    } catch {
      /* Dados que não são JSON: nada para ecoar. */
    }
  }
  return {};
}

function schemaType(schema: JsonRecord): string | undefined {
  const type = schema.type;
  if (typeof type === 'string') return type;
  if (Array.isArray(type))
    return type.find((t): t is string => typeof t === 'string' && t !== 'null');
  return undefined;
}

/**
 * Valor que satisfaz o JSON Schema pedido. Campos que existem nos dados de
 * origem com o mesmo nome e tipo são devolvidos iguais: "melhorar" no modo
 * simulado é devolver o original, que passa nas guardas de essência.
 */
export function fakeFromSchema(
  schema: unknown,
  source: JsonRecord = {},
  key?: string,
): unknown {
  if (!isRecord(schema)) return AI_FAKE_TEXT;
  const variants = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(variants) && variants.length)
    return fakeFromSchema(
      variants.find((v) => isRecord(v) && schemaType(v) !== 'null') ??
        variants[0],
      source,
      key,
    );
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  const echoed = key === undefined ? undefined : source[key];
  switch (schemaType(schema)) {
    case 'object': {
      const properties = isRecord(schema.properties) ? schema.properties : {};
      const nested = isRecord(echoed) ? echoed : source;
      return Object.fromEntries(
        Object.entries(properties).map(([name, child]) => [
          name,
          fakeFromSchema(child, nested, name),
        ]),
      );
    }
    case 'array': {
      if (Array.isArray(echoed)) return echoed;
      const min = typeof schema.minItems === 'number' ? schema.minItems : 0;
      return Array.from({ length: min }, () =>
        fakeFromSchema(schema.items, {}, undefined),
      );
    }
    case 'boolean':
      return key !== undefined && key in AI_FAKE_BOOLEANS
        ? AI_FAKE_BOOLEANS[key]
        : typeof echoed === 'boolean'
          ? echoed
          : false;
    case 'integer':
    case 'number':
      return typeof echoed === 'number'
        ? echoed
        : typeof schema.minimum === 'number'
          ? schema.minimum
          : 0;
    case 'string':
      return typeof echoed === 'string' ? echoed : AI_FAKE_TEXT;
    default:
      return echoed ?? null;
  }
}

function openAiSchema(body: JsonRecord): unknown {
  const text = isRecord(body.text) ? body.text : {};
  const format = isRecord(text.format) ? text.format : {};
  return format.schema;
}

function geminiSchema(body: JsonRecord): unknown {
  const config = isRecord(body.generationConfig) ? body.generationConfig : {};
  return config.responseJsonSchema ?? config.responseSchema;
}

function wantsGeminiImage(body: JsonRecord): boolean {
  const config = isRecord(body.generationConfig) ? body.generationConfig : {};
  return (
    Array.isArray(config.responseModalities) &&
    config.responseModalities.some((m) => String(m).toUpperCase() === 'IMAGE')
  );
}

function ok(data: unknown): AiQueueResponse {
  return { data, status: 200, headers: { 'x-ai-provider-mode': 'fake' } };
}

/**
 * Resposta simulada para um pedido da fila de IA, no formato do provedor.
 * Nunca faz rede. Respostas JSON seguem o schema pedido; rotas de imagem
 * devolvem um PNG 1×1.
 */
export function fakeAiResponse(request: AiQueueRequest): AiQueueResponse {
  const path = new URL(request.url).pathname;
  const body = restoreAiBody(request.body);
  const json = isRecord(body) ? body : {};
  const source = extractSourceData(body);

  if (request.method === AiQueueMethod.GET)
    return request.provider === AiQueueProviderName.OPENAI
      ? ok({
          data: [
            { id: AI_FAKE_MODELS.text, object: 'model' },
            { id: AI_FAKE_MODELS.image, object: 'model' },
          ],
        })
      : ok({
          models: [
            {
              name: `models/${AI_FAKE_MODELS.text}`,
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: `models/${AI_FAKE_MODELS.image}`,
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        });

  if (request.provider === AiQueueProviderName.OPENAI) {
    if (path.startsWith('/v1/images/'))
      return ok({ data: [{ b64_json: AI_FAKE_PNG_BASE64 }] });
    const schema = openAiSchema(json);
    const text = schema
      ? JSON.stringify(fakeFromSchema(schema, source))
      : AI_FAKE_TEXT;
    return ok({
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text }],
        },
      ],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    });
  }

  if (path.endsWith('/interactions'))
    return ok({
      status: 'completed',
      outputs: [{ type: 'text', text: AI_FAKE_TEXT }],
    });
  if (wantsGeminiImage(json))
    return ok({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: { mimeType: 'image/png', data: AI_FAKE_PNG_BASE64 },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    });
  const schema = geminiSchema(json);
  return ok({
    candidates: [
      {
        content: {
          parts: [
            {
              text: schema
                ? JSON.stringify(fakeFromSchema(schema, source))
                : AI_FAKE_TEXT,
            },
          ],
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: { totalTokenCount: 0 },
  });
}
