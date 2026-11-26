import {
  CSS_PIXELS_PER_POINT,
  DOCX_HALF_POINTS_PER_POINT,
  DOCUMENT_DEFAULT_FONT_SIZE,
  DOCX_LINE_UNITS_PER_LINE,
  DOCUMENT_LINK_PROTOCOLS,
  DOCUMENT_MAX_FONT_SIZE_PT,
  DOCUMENT_MAX_LINE_HEIGHT,
  DOCUMENT_MAX_TABLE_SPAN,
} from './constants/lesson-document.constants';
import type { LessonDocumentSpacing } from './types/lesson-document.types';
import { LineRuleType } from 'docx';

/**
 * Converts a CSS font size to DOCX half-points. `pt` and `px` are absolute;
 * `em`, `rem` and `%` are relative to `baseHalfPoints` (the surrounding run).
 * Anything unparseable or out of range yields `undefined` (caller's default).
 */
export function documentFontSize(
  value: unknown,
  baseHalfPoints: number = DOCUMENT_DEFAULT_FONT_SIZE,
): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(pt|px|em|rem|%)$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const basePoints = baseHalfPoints / DOCX_HALF_POINTS_PER_POINT;
  const points =
    unit === 'pt'
      ? amount
      : unit === 'px'
        ? amount / CSS_PIXELS_PER_POINT
        : unit === '%'
          ? (basePoints * amount) / 100
          : basePoints * amount;
  return points > 0 && points <= DOCUMENT_MAX_FONT_SIZE_PT
    ? Math.round(points * DOCX_HALF_POINTS_PER_POINT)
    : undefined;
}

export function documentFontFamily(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const font = value
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
  // A CSS variable or generic keyword is not an installable font family.
  if (!font || font.length > 100 || /[()<>]/.test(font)) return undefined;
  return font;
}

export function documentLineSpacing(
  attributes: Record<string, unknown>,
  defaults: LessonDocumentSpacing,
): LessonDocumentSpacing {
  const lineHeight = Number(attributes.lineHeight);
  return Number.isFinite(lineHeight) &&
    lineHeight > 0 &&
    lineHeight <= DOCUMENT_MAX_LINE_HEIGHT
    ? {
        ...defaults,
        line: Math.round(lineHeight * DOCX_LINE_UNITS_PER_LINE),
        lineRule: LineRuleType.AUTO,
      }
    : defaults;
}

export function documentLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return DOCUMENT_LINK_PROTOCOLS.includes(url.protocol) &&
      (url.hostname || url.pathname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function documentTableSpan(value: unknown): number {
  const span = Number(value);
  return Number.isInteger(span) && span > 0 && span <= DOCUMENT_MAX_TABLE_SPAN
    ? span
    : 1;
}

export function documentCellWidth(value: unknown): number | undefined {
  if (!Array.isArray(value)) return undefined;
  const widths: unknown[] = value;
  if (
    !widths.length ||
    !widths.every(
      (width) =>
        typeof width === 'number' && Number.isFinite(width) && width > 0,
    )
  )
    return undefined;
  return Math.round(
    widths.reduce<number>((sum, width) => sum + Number(width), 0) * 15,
  );
}
