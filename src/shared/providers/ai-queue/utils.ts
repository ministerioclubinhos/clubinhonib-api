import { AxiosError, AxiosHeaders } from 'axios';
import { RedisOptions } from 'ioredis';
import {
  AI_QUEUE,
  AI_QUEUE_NETWORK_CODES,
  AI_QUEUE_PROVIDER_ERROR_CODES,
  AI_QUEUE_SAFE_HEADERS,
} from './constants';
import {
  AiQueueBodyKind,
  AiQueueFailure,
  AiQueueMethod,
  AiQueueProviderName,
} from './enums';
import {
  AiQueueBody,
  AiQueueEndpoint,
  AiQueueProviderError,
  AiQueueTransportFailure,
} from './types';
import { AiQueueException } from './ai-queue.exception';

export function redisConnection(value: string): RedisOptions {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('REDIS_URL inválida.');
  }
  const db = url.pathname.replace(/^\//, '') || '0';
  if (
    !['redis:', 'rediss:'].includes(url.protocol) ||
    !url.hostname ||
    !/^\d+$/.test(db) ||
    url.search ||
    url.hash
  )
    throw new Error('REDIS_URL inválida.');
  return {
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port || 6379),
    db: Number(db),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    connectTimeout: AI_QUEUE.connectionMs,
  };
}
export function queueInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum)
    throw new Error(`${name} deve ser inteiro entre 1 e ${maximum}.`);
  return number;
}
export function aiQueueEndpoint(
  value: string,
  method: AiQueueMethod,
): AiQueueEndpoint {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AiQueueException(AiQueueFailure.INVALID_REQUEST);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    throw new AiQueueException(AiQueueFailure.INVALID_REQUEST);
  if (
    url.hostname === 'api.openai.com' &&
    ((method === AiQueueMethod.GET && url.pathname === '/v1/models') ||
      (method === AiQueueMethod.POST &&
        [
          '/v1/responses',
          '/v1/images/generations',
          '/v1/images/edits',
        ].includes(url.pathname)))
  )
    return { provider: AiQueueProviderName.OPENAI, url: url.href };
  if (
    url.hostname === 'generativelanguage.googleapis.com' &&
    method === AiQueueMethod.POST &&
    (url.pathname === '/v1beta/interactions' ||
      /^\/v1beta\/models\/[^/]+:generateContent$/.test(url.pathname))
  )
    return { provider: AiQueueProviderName.GEMINI, url: url.href };
  throw new AiQueueException(AiQueueFailure.INVALID_REQUEST);
}
export async function serializeAiBody(
  body: object | FormData,
): Promise<AiQueueBody> {
  if (!(body instanceof FormData))
    return { kind: AiQueueBodyKind.JSON, json: body };
  const parts = [] as NonNullable<AiQueueBody['parts']>;
  for (const [name, value] of body.entries()) {
    if (typeof value === 'string') parts.push({ name, text: value });
    else
      parts.push({
        name,
        filename: value.name,
        mimeType: value.type,
        base64: Buffer.from(await value.arrayBuffer()).toString('base64'),
      });
  }
  return { kind: AiQueueBodyKind.MULTIPART, parts };
}
export function restoreAiBody(body: AiQueueBody): object | FormData {
  if (body.kind === AiQueueBodyKind.JSON) return body.json ?? {};
  const form = new FormData();
  for (const part of body.parts ?? []) {
    if (part.text !== undefined) form.append(part.name, part.text);
    else
      form.append(
        part.name,
        new Blob([new Uint8Array(Buffer.from(part.base64 ?? '', 'base64'))], {
          type: part.mimeType,
        }),
        part.filename,
      );
  }
  return form;
}
export function safeAiHeaders(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value || typeof value !== 'object') return result;
  for (const name of AI_QUEUE_SAFE_HEADERS) {
    const field: unknown = Reflect.get(value, name);
    if (typeof field === 'string' || typeof field === 'number')
      result[name] = String(field).slice(0, 256);
  }
  return result;
}
function allowedProviderCode(value: unknown): string | undefined {
  return typeof value === 'string' &&
    (AI_QUEUE_PROVIDER_ERROR_CODES as readonly string[]).includes(value)
    ? value
    : undefined;
}
export function serializeAiError(value: unknown): AiQueueProviderError {
  if (value instanceof AiQueueException)
    return { queueFailure: value.reason, freeTierQuota: false, headers: {} };
  const error = value as AiQueueTransportFailure | null;
  const response =
    error && typeof error === 'object' ? error.response : undefined;
  const data = response?.data;
  const detail: unknown =
    data && typeof data === 'object' ? Reflect.get(data, 'error') : undefined;
  const field = (name: string): unknown =>
    detail && typeof detail === 'object'
      ? Reflect.get(detail, name)
      : undefined;
  const serialized = JSON.stringify(data ?? '').toLowerCase();
  const headers = safeAiHeaders(response?.headers);
  const message = field('message');
  const retry =
    typeof message === 'string'
      ? message.match(/try again in ([\d.]+)s/i)
      : null;
  if (!headers['retry-after'] && retry && Number.isFinite(Number(retry[1])))
    headers['retry-after'] = String(Number(retry[1]));
  const networkCode = [error?.code, error?.cause?.code].find(
    (code) =>
      typeof code === 'string' &&
      (AI_QUEUE_NETWORK_CODES as readonly string[]).includes(code),
  );
  return {
    status: typeof response?.status === 'number' ? response.status : undefined,
    code: typeof networkCode === 'string' ? networkCode : undefined,
    // Gemini sends the HTTP number in `code` and the canonical name in `status`.
    providerCode: allowedProviderCode(field('code')),
    providerStatus: allowedProviderCode(field('status')),
    type: allowedProviderCode(field('type')),
    freeTierQuota:
      serialized.includes('free tier') &&
      /limit(?:[^0-9]+)0\s+requests\s+per\s+day/.test(serialized),
    headers,
  };
}
export function restoreAiError(error: AiQueueProviderError): AxiosError {
  const message = error.freeTierQuota
    ? 'Free tier quota limit: 0 requests per day.'
    : 'O provedor de IA não concluiu a solicitação.';
  return new AxiosError(
    message,
    error.code,
    undefined,
    undefined,
    error.status
      ? {
          status: error.status,
          statusText: '',
          headers: error.headers,
          config: { headers: new AxiosHeaders() },
          data: {
            error: {
              code: error.providerCode,
              status: error.providerStatus,
              type: error.type,
              message,
            },
          },
        }
      : undefined,
  );
}
/** Payload size without serializing the whole job a second time. */
export function aiBodyBytes(body: AiQueueBody): number {
  if (body.kind === AiQueueBodyKind.JSON)
    return Buffer.byteLength(JSON.stringify(body.json ?? {}));
  return (body.parts ?? []).reduce(
    (total, part) =>
      total +
      part.name.length +
      (part.text ? Buffer.byteLength(part.text) : 0) +
      (part.base64?.length ?? 0) +
      (part.filename?.length ?? 0) +
      (part.mimeType?.length ?? 0),
    0,
  );
}
/** Safe to log: never a URL query, body, header or credential. */
export function aiQueuePath(url: string): string {
  try {
    return new URL(url).pathname.slice(0, AI_QUEUE.logValueLength);
  } catch {
    return 'invalid-url';
  }
}
export function aiQueueErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) return 'erro desconhecido';
  const code: unknown = Reflect.get(error, 'code');
  return `${typeof code === 'string' ? `${code}: ` : ''}${error.message}`.slice(
    0,
    AI_QUEUE.logValueLength,
  );
}
