import {
  CSS_NAMED_COLORS,
  XML_ALLOWED_CONTROL_CODES,
  XML_FIRST_PRINTABLE_CODE,
  XML_NONCHARACTER_CODES,
} from '../constants/lesson-document.constants';

function isXmlCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  if (code < XML_FIRST_PRINTABLE_CODE)
    return XML_ALLOWED_CONTROL_CODES.has(code);
  return !XML_NONCHARACTER_CODES.has(code);
}

/** Removes the control characters that make `document.xml` invalid XML 1.0. */
export function sanitizeDocxText(value: string): string {
  return Array.from(value).filter(isXmlCharacter).join('');
}

/** Splits text on line breaks, sanitised, for one TextRun per line. */
export function docxTextLines(value: string): string[] {
  return sanitizeDocxText(value).split(/\r?\n/);
}

function channel(value: string): string | null {
  const trimmed = value.trim();
  const number = trimmed.endsWith('%')
    ? (Number.parseFloat(trimmed) * 255) / 100
    : Number.parseFloat(trimmed);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(255, Math.round(number)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

/**
 * Normalises a CSS colour (`#rrggbb`, `#rgb`, `rgb()/rgba()`, keyword) to the
 * six-digit hex DOCX requires. Returns `undefined` for anything else, so the
 * caller applies its default instead of producing an invalid document.
 */
export function normalizeDocxColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim().toLowerCase();
  if (!raw) return undefined;
  const hex = raw.replace(/^#/, '');
  if (/^[\da-f]{6}$/.test(hex)) return hex.toUpperCase();
  if (/^[\da-f]{8}$/.test(hex)) return hex.slice(0, 6).toUpperCase();
  if (/^[\da-f]{3}$/.test(hex))
    return Array.from(hex)
      .map((digit) => digit + digit)
      .join('')
      .toUpperCase();
  const rgb = raw.match(/^rgba?\(\s*([^)]+)\)$/);
  if (rgb) {
    const channels = rgb[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(channel);
    return channels.length === 3 && channels.every((item) => item !== null)
      ? channels.join('')
      : undefined;
  }
  return CSS_NAMED_COLORS[raw];
}
