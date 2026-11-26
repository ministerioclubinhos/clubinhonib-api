import { AxiosError, AxiosHeaders } from 'axios';
import {
  AI_FAKE_HTTP_FAULTS,
  AI_FAKE_INVALID_JSON,
  AI_FAKE_JOURNAL_MAX_STRING,
  AI_FAKE_MARKER,
  AI_FAKE_NETWORK_FAULTS,
  AI_FAKE_RETRY_AFTER_SECONDS,
  AI_FAKE_REWRITE_TEXT,
  AI_FAKE_TEXT,
} from './constants';
import { AiFakeScenario, AiQueueProviderName } from './enums';
import { AiFakeFault, AiQueueRequest, AiQueueResponse } from './types';
import { restoreAiBody } from './utils';

/** Todas as cadeias do pedido (JSON ou multipart), sem os anexos. */
function requestText(request: AiQueueRequest): string {
  const parts = request.body.parts ?? [];
  return JSON.stringify([
    request.body.json ?? null,
    parts.map((part) => part.text ?? ''),
  ]);
}

/** O cenário pedido pelo marcador, se houver um conhecido. */
export function findAiFakeFault(request: AiQueueRequest): AiFakeFault | null {
  const match = AI_FAKE_MARKER.exec(requestText(request));
  if (!match) return null;
  const [marker, name, times] = match;
  const scenario = Object.values(AiFakeScenario).find(
    (item) => String(item) === name,
  );
  if (!scenario) return null;
  return { marker, scenario, times: times ? Number(times) : null };
}

type HttpScenario = keyof typeof AI_FAKE_HTTP_FAULTS;
type NetworkScenario = keyof typeof AI_FAKE_NETWORK_FAULTS;

const isHttp = (value: string): value is HttpScenario =>
  value in AI_FAKE_HTTP_FAULTS;
const isNetwork = (value: string): value is NetworkScenario =>
  value in AI_FAKE_NETWORK_FAULTS;

/**
 * O erro que o axios lançaria: com resposta HTTP no formato do provedor, ou só
 * com o código de rede. `null` quando o cenário não é uma falha de transporte.
 */
export function aiFakeTransportError(
  request: AiQueueRequest,
  scenario: AiFakeScenario,
): AxiosError | null {
  if (isNetwork(scenario)) {
    const code = AI_FAKE_NETWORK_FAULTS[scenario];
    return new AxiosError(`falha simulada: ${code}`, code);
  }
  if (!isHttp(scenario)) return null;

  const fault = AI_FAKE_HTTP_FAULTS[scenario];
  const gemini = request.provider === AiQueueProviderName.GEMINI;
  const message = `falha simulada: ${scenario}`;

  return new AxiosError(message, 'ERR_BAD_REQUEST', undefined, undefined, {
    status: fault.status,
    statusText: '',
    headers:
      fault.status === 429
        ? { 'retry-after': AI_FAKE_RETRY_AFTER_SECONDS }
        : {},
    config: { headers: new AxiosHeaders() },
    data: {
      error: gemini
        ? { code: fault.status, status: fault.geminiStatus, message }
        : { code: fault.code, type: fault.code, message },
    },
  });
}

/** Aplica `change` a cada texto ecoado, mantendo o formato JSON. */
function mapStrings(value: unknown, change: (text: string) => string): unknown {
  if (typeof value === 'string')
    return value === AI_FAKE_TEXT ? value : change(value);
  if (Array.isArray(value))
    return value.map((item) => mapStrings(item, change));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        mapStrings(item, change),
      ]),
    );
  return value;
}

function mapJson(text: string, change: (value: string) => string): string {
  try {
    return JSON.stringify(mapStrings(JSON.parse(text), change));
  } catch {
    return change(text);
  }
}

/** Copidesque: sem o marcador, uma frase bem formada e nada além do original. */
export function polishText(text: string): string {
  const clean = text
    .replace(new RegExp(AI_FAKE_MARKER, 'g'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (!clean) return clean;
  const first = clean.charAt(0).toLocaleUpperCase('pt-BR');
  const capitalized = `${first}${clean.slice(1)}`;
  return /[.!?…:]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/** Altera uma resposta bem-sucedida conforme o cenário (texto dos dois provedores). */
export function applyAiFakeResponseFault(
  response: AiQueueResponse,
  scenario: AiFakeScenario,
): AiQueueResponse {
  const data = structuredClone(response.data) as {
    status?: string;
    incomplete_details?: { reason: string };
    output?: { content?: { type: string; text?: string }[] }[];
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string }[] };
    }[];
  };
  const texts = [
    ...(data.output ?? []).flatMap((item) => item.content ?? []),
    ...(data.candidates ?? []).flatMap((item) => item.content?.parts ?? []),
  ].filter((part) => typeof part.text === 'string');

  if (scenario === AiFakeScenario.INVALID_JSON)
    texts.forEach((part) => (part.text = AI_FAKE_INVALID_JSON));

  if (scenario === AiFakeScenario.REWRITE)
    texts.forEach(
      (part) =>
        (part.text = mapJson(part.text ?? '', () => AI_FAKE_REWRITE_TEXT)),
    );

  if (scenario === AiFakeScenario.POLISH)
    texts.forEach((part) => (part.text = mapJson(part.text ?? '', polishText)));

  if (scenario === AiFakeScenario.TRUNCATED) {
    texts.forEach((part) => (part.text = (part.text ?? '').slice(0, 12)));
    if (data.candidates) {
      data.candidates.forEach((item) => (item.finishReason = 'MAX_TOKENS'));
    } else {
      data.status = 'incomplete';
      data.incomplete_details = { reason: 'max_output_tokens' };
    }
  }

  return { ...response, data };
}

/** Uma linha do diário: o pedido como saiu, sem o conteúdo dos anexos. */
export function aiFakeJournalLine(
  request: AiQueueRequest,
  scenario: AiFakeScenario | null,
): string {
  return `${JSON.stringify(
    {
      at: new Date().toISOString(),
      feature: request.feature,
      provider: request.provider,
      path: new URL(request.url).pathname,
      scenario,
      body: restoreAiBody({ ...request.body, parts: undefined }),
      parts: request.body.parts?.map(({ name, text, filename }) => ({
        name,
        text,
        filename,
      })),
    },
    (_key, value: unknown) =>
      typeof value === 'string' && value.length > AI_FAKE_JOURNAL_MAX_STRING
        ? `<${value.length} caracteres>`
        : value,
  )}\n`;
}
