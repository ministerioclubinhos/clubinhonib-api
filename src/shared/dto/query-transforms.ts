/**
 * Conversões usadas pelos DTOs de consulta.
 *
 * Uma query string traz tudo como texto, e cada módulo carregava a sua cópia
 * destas três funções — já com diferenças entre si sobre o que aceitar.
 */

/**
 * `true`/`false` como texto. Valor fora do par vira `undefined`, e o filtro
 * simplesmente não entra na consulta.
 */
export const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return undefined;

  const text = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(text)) return true;
  if (['false', '0', 'no', 'n'].includes(text)) return false;
  return undefined;
};

/** Número inteiro; texto não numérico vira `undefined`. */
export const toOptionalInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Texto sem espaços nas pontas; vazio vira ausente. */
export const toOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

/** Texto em maiúsculas, para casar com um enum de direção de ordenação. */
export const toUpperCaseText = (value: unknown): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

/** Texto em minúsculas, para casar com um enum de direção de ordenação. */
export const toLowerCaseText = (value: unknown): unknown =>
  typeof value === 'string' ? value.toLowerCase() : value;
