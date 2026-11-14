import type { MeditationJson } from '../types/younger-meditation.types';
import {
  meditationNodeText,
  meditationRichNodes,
} from './meditation-rich-text.utils';
import { MEDITATION_HEADING_SCALE } from '../constants/meditation-formatting.constants';
import { OLDER_MEDITATION_LAYOUT as O } from '../constants/older-meditation-layout.constants';
import { documentFontSize } from '../lessonDocument.utils';

function object(value: unknown): MeditationJson {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MeditationJson)
    : {};
}
function largestSize(node: MeditationJson, fallback: number): number {
  const marks = Array.isArray(node.marks) ? node.marks.map(object) : [];
  const style = object(marks.find((mark) => mark.type === 'textStyle')?.attrs);
  const size = documentFontSize(style.fontSize, fallback) ?? fallback;
  return Math.max(
    size,
    ...(Array.isArray(node.content)
      ? node.content.map((child) => largestSize(object(child), fallback))
      : []),
  );
}

/** Account for saved large fonts, headings, spacing and tables before committing to one page. */
export function olderMeditationRichHeight(
  document: MeditationJson | undefined,
  field: string,
  baseSize: number,
  columns: number,
): number {
  const measure = (node: MeditationJson, width: number): number => {
    const children = Array.isArray(node.content)
      ? node.content.map(object)
      : [];
    if (node.type === 'table')
      return children.reduce((sum, row) => {
        const cells = Array.isArray(row.content) ? row.content.map(object) : [];
        return (
          sum +
          Math.max(
            0,
            ...cells.map((cell) =>
              (Array.isArray(cell.content)
                ? cell.content.map(object)
                : []
              ).reduce(
                (height, child) =>
                  height + measure(child, width / Math.max(cells.length, 1)),
                0,
              ),
            ),
          )
        );
      }, 0);
    if (
      ['bulletList', 'orderedList', 'listItem', 'blockquote'].includes(
        String(node.type),
      )
    )
      return children.reduce((sum, child) => sum + measure(child, width), 0);
    const attrs = object(node.attrs);
    const scale =
      node.type === 'heading' && field !== 'title'
        ? (MEDITATION_HEADING_SCALE[Number(attrs.level)] ?? 1)
        : 1;
    const size = largestSize(node, baseSize) * scale;
    const lineHeight =
      typeof attrs.lineHeight === 'string'
        ? Number.parseFloat(attrs.lineHeight)
        : 1.2;
    const actualColumns = Math.max(1, Math.floor((width * baseSize) / size));
    const lines = meditationNodeText(node)
      .split(/\r?\n/)
      .reduce(
        (sum, line) =>
          sum + Math.max(1, Math.ceil(line.length / actualColumns)),
        0,
      );
    return (
      lines *
      size *
      O.lineHeight *
      (Number.isFinite(lineHeight) ? Math.max(lineHeight / 1.2, 1) : 1)
    );
  };
  return meditationRichNodes(document, field).reduce(
    (sum, node) => sum + measure(node, columns),
    0,
  );
}
