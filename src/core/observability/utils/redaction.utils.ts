import { JsonObject, JsonValue } from 'src/shared/providers/log-storage/types';

import {
  METADATA_KEY_ALLOWLIST,
  METADATA_MAX_ARRAY,
  METADATA_MAX_DEPTH,
  METADATA_MAX_KEYS,
  REDACTED_MARKER,
  SENSITIVE_KEYS,
  SENSITIVE_KEY_FRAGMENTS,
  STRING_MAX_LENGTH,
  TRUNCATION_MARKER,
} from '../constants';
import { RedactionLimits } from '../types';

const DEFAULT_LIMITS: RedactionLimits = {
  maxDepth: METADATA_MAX_DEPTH,
  maxKeys: METADATA_MAX_KEYS,
  maxArray: METADATA_MAX_ARRAY,
  maxStringLength: STRING_MAX_LENGTH,
};

const BEARER_PATTERN = /bearer\s+[a-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN =
  /eyJ[a-zA-Z0-9_-]{4,}\.[a-zA-Z0-9_-]{4,}\.[a-zA-Z0-9_-]{4,}/g;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_PATTERN = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g;
const URL_QUERY_PATTERN = /(https?:\/\/[^\s?#]+)\?[^\s#]*/gi;

/** A chave carrega segredo ou dado pessoal? */
export function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return (
    SENSITIVE_KEYS.has(lowered) ||
    SENSITIVE_KEY_FRAGMENTS.some((fragment) => lowered.includes(fragment))
  );
}

/** Corta com marcador explícito; nunca em silêncio. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const keep = Math.max(0, maxLength - TRUNCATION_MARKER.length);
  return `${text.slice(0, keep)}${TRUNCATION_MARKER}`;
}

/**
 * Remove de um texto livre o que não pode ser persistido.
 *
 * Mensagens de vendors e de exceções carregam token, e-mail e URL com query;
 * o texto continua útil para diagnóstico sem esses trechos.
 */
export function redactText(
  text: string,
  maxLength: number = STRING_MAX_LENGTH,
): string {
  const cleaned = text
    .replace(URL_QUERY_PATTERN, '$1')
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_MARKER}`)
    .replace(JWT_PATTERN, REDACTED_MARKER)
    .replace(EMAIL_PATTERN, REDACTED_MARKER)
    .replace(CPF_PATTERN, REDACTED_MARKER)
    .replace(PHONE_PATTERN, REDACTED_MARKER);
  return truncate(cleaned, maxLength);
}

/** Remove a query string de uma URL ou caminho; a rota template é o que vale. */
export function stripQueryString(url: string): string {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

/**
 * Converte um valor desconhecido em JSON seguro: chaves sensíveis redigidas,
 * profundidade e quantidade limitadas, ciclos, `bigint`, símbolos e funções
 * resolvidos.
 */
export function redactValue(
  value: unknown,
  limits: RedactionLimits = DEFAULT_LIMITS,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string')
    return redactText(value, limits.maxStringLength);
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'symbol') return '[symbol]';
  if (typeof value === 'function') return '[function]';
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[buffer:${value.byteLength}]`;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message, limits.maxStringLength),
    };
  }
  if (typeof value !== 'object') return '[unknown]';
  if (seen.has(value)) return '[circular]';
  if (depth >= limits.maxDepth) return '[depth-limit]';
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value
      .slice(0, limits.maxArray)
      .map((item) => redactValue(item, limits, depth + 1, seen));
    if (value.length > limits.maxArray) items.push(TRUNCATION_MARKER);
    return items;
  }

  const result: JsonObject = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, entry] of entries.slice(0, limits.maxKeys)) {
    result[key] = isSensitiveKey(key)
      ? REDACTED_MARKER
      : redactValue(entry, limits, depth + 1, seen);
  }
  if (entries.length > limits.maxKeys) result[TRUNCATION_MARKER] = true;
  return result;
}

/** Metadata do evento técnico: só chaves allowlisted, e ainda redigidas. */
export function redactMetadata(
  metadata: Record<string, unknown> | null | undefined,
): JsonObject | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!METADATA_KEY_ALLOWLIST.has(key) || isSensitiveKey(key)) continue;
    result[key] = redactValue(value);
  }
  return Object.keys(result).length > 0 ? result : null;
}
