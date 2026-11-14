import { OLDER_MEDITATION_LAYOUT as O } from '../constants/older-meditation-layout.constants';

/**
 * A code legend written on one line ("Código: A=1, B=2, …" or "1 = E | 2 = A")
 * as [symbol, meaning] pairs, or null when the line is not a legend.
 */
export function codeLegendPairs(line: string): Array<[string, string]> | null {
  const body = line.replace(/^\s*(código|legenda|tabela)\s*:?\s*/i, '').trim();
  const pairs = [
    ...body.matchAll(/([^\s=,;|]{1,3})\s*=\s*([^\s=,;|]{1,3})/gu),
  ].map((match): [string, string] => [match[1], match[2]]);
  const leftover = body
    .replace(/([^\s=,;|]{1,3})\s*=\s*([^\s=,;|]{1,3})/gu, '')
    .replace(/[\s,;|]/g, '');
  return pairs.length >= O.codeLegendMinimumPairs && !leftover ? pairs : null;
}

const lettersOnly = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

/**
 * Decodes the ciphered lines of a code exercise with its own legend, or null
 * when the exercise has no legend or no ciphered line to check.
 */
export function decodeMeditationCode(supportText: string): string | null {
  const lines = supportText.split(/\r?\n/);
  const legend = lines.map(codeLegendPairs).find(Boolean);
  if (!legend) return null;
  const clean = (value: string): string => value.replace(/[.,;:]+$/, '');
  const table = new Map<string, string>();
  for (const [left, right] of legend) {
    const [symbol, letter] = /^\p{L}$/u.test(clean(left))
      ? [clean(right), clean(left)]
      : [clean(left), clean(right)];
    table.set(symbol, letter);
  }
  const ciphered = lines
    .filter((line) => !codeLegendPairs(line))
    .map((line) =>
      line.replace(/^\s*(código|codigo|frase)\s*:?\s*/i, '').trim(),
    )
    .filter((line) => /\d/.test(line) && !/\p{L}{3,}/u.test(line));
  if (!ciphered.length) return null;
  return ciphered
    .map((line) =>
      line
        .split(/\s*\/\s*|\s{2,}/)
        .map((word) =>
          word
            .split(/[-\s]+/)
            .filter(Boolean)
            .map((symbol) => table.get(clean(symbol)) ?? '?')
            .join(''),
        )
        .join(' '),
    )
    .join(' ');
}

/** True when the ciphered text, decoded with its legend, gives the answer. */
export function meditationCodeMatches(
  supportText: string,
  answer: string,
): boolean {
  const decoded = decodeMeditationCode(supportText);
  return decoded === null || lettersOnly(decoded) === lettersOnly(answer);
}
