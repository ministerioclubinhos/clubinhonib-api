/**
 * Funções puras do módulo de crianças.
 *
 * Antes cada serviço carregava a sua cópia de `toDateOnlyStr`, e as quatro já
 * podiam divergir sem que nada acusasse.
 */

/**
 * Data em `YYYY-MM-DD`.
 *
 * As colunas de nascimento e entrada são de data pura e podem voltar como
 * `Date` ou como texto, conforme o driver. Cortar no `T` mantém o dia do
 * calendário sem passar por fuso.
 */
export function toDateOnly(
  value: string | Date | undefined | null,
): string | null {
  if (value === undefined || value === null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return dateOnly[1];

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

/** Carimbo completo em ISO; entrada inválida vira o instante atual. */
export function toIsoDateTime(value: unknown): string {
  const text = String(value);
  if (/\d{4}-\d{2}-\d{2}T/.test(text)) return text;

  const parsed = value instanceof Date ? value : new Date(text);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}
