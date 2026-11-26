import {
  AlignmentType,
  BorderStyle,
  ExternalHyperlink,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';
import {
  MEDITATION_ACTIVITY_FIELDS,
  MEDITATION_FORMATTING_LABELS,
  MEDITATION_HEADING_SCALE,
} from '../constants/meditation-formatting.constants';
import type { MeditationJson } from '../types/younger-meditation.types';
import { YOUNGER_MEDITATION_LAYOUT as L } from '../constants/younger-meditation-layout.constants';
import { DOCUMENT_DEFAULT_COLOR } from '../constants/lesson-document.constants';
import {
  documentFontFamily,
  documentFontSize,
  documentLink,
} from '../lessonDocument.utils';
import {
  docxTextLines,
  normalizeDocxColor,
  sanitizeDocxText,
} from './docx-text.utils';

function object(value: unknown): MeditationJson {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MeditationJson)
    : {};
}
export function meditationNodeText(value: unknown): string {
  const node = object(value);
  if (node.type === 'hardBreak') return '\n';
  return typeof node.text === 'string'
    ? node.text
    : Array.isArray(node.content)
      ? node.content
          .map(meditationNodeText)
          .join(
            [
              'bulletList',
              'orderedList',
              'listItem',
              'table',
              'tableRow',
              'tableCell',
              'tableHeader',
            ].includes(String(node.type))
              ? '\n'
              : '',
          )
      : '';
}
export function meditationRichNodes(
  document: MeditationJson | undefined,
  field: string,
): MeditationJson[] {
  const nodes = Array.isArray(document?.content)
    ? document.content.map(object)
    : [];
  const activity = Number(field.match(/^activity([1-4])$/)?.[1]);
  const marker = activity ? MEDITATION_ACTIVITY_FIELDS[activity - 1] : field;
  const marked = nodes.filter(
    (node) => object(node.attrs).meditationField === marker,
  );
  if (marked.length) return marked;
  if (field === 'title') {
    const node = nodes.find(
      (node) =>
        node.type === 'heading' &&
        Number(object(node.attrs).level) === 1 &&
        !/^MEDITAÇÃO|^LIÇÃO\s+\d|^TÍTULO$/i.test(
          meditationNodeText(node).trim(),
        ),
    );
    return node ? [node] : [];
  }
  const headings = nodes.flatMap((node, index) =>
    node.type === 'heading' && meditationNodeText(node).trim() === 'INSTRUÇÃO'
      ? [index]
      : [],
  );
  const index = activity
    ? headings[activity - 1]
    : nodes.findIndex(
        (node) =>
          node.type === 'heading' &&
          meditationNodeText(node).trim().toUpperCase() ===
            MEDITATION_FORMATTING_LABELS[field],
      );
  if (index === undefined || index < 0) return [];
  const remaining = nodes.slice(index + 1);
  const end = remaining.findIndex(
    (node) => node.type === 'heading' && !object(node.attrs).meditationField,
  );
  const content = end < 0 ? remaining : remaining.slice(0, end);
  return field === 'verseText'
    ? content.slice(0, 1)
    : field === 'verseReference'
      ? content.slice(1, 2)
      : content;
}
function runs(
  node: MeditationJson,
  size: number,
  bold: boolean,
): Array<TextRun | ExternalHyperlink> {
  if (node.type === 'hardBreak') return [new TextRun({ break: 1 })];
  if (typeof node.text === 'string') {
    const marks = Array.isArray(node.marks) ? node.marks.map(object) : [];
    const style = object(
      marks.find((mark) => mark.type === 'textStyle')?.attrs,
    );
    const highlight = object(
      marks.find((mark) => mark.type === 'highlight')?.attrs,
    );
    const color = normalizeDocxColor(style.color) ?? DOCUMENT_DEFAULT_COLOR;
    const fontSize = documentFontSize(style.fontSize, size) ?? size;
    const font = documentFontFamily(style.fontFamily) ?? L.font;
    const highlightFill = marks.some((mark) => mark.type === 'highlight')
      ? normalizeDocxColor(highlight.color)
      : undefined;
    const textRuns = docxTextLines(node.text).map(
      (line, index) =>
        new TextRun({
          text: line,
          ...(index ? { break: 1 } : {}),
          font,
          size: fontSize,
          bold: bold || marks.some((mark) => mark.type === 'bold'),
          italics: marks.some((mark) => mark.type === 'italic'),
          strike: marks.some((mark) => mark.type === 'strike'),
          subScript: marks.some((mark) => mark.type === 'subscript'),
          superScript: marks.some((mark) => mark.type === 'superscript'),
          ...(marks.some((mark) => mark.type === 'underline')
            ? { underline: { type: UnderlineType.SINGLE } }
            : {}),
          color,
          ...(highlightFill ? { shading: { fill: highlightFill } } : {}),
        }),
    );
    const href = documentLink(
      object(marks.find((mark) => mark.type === 'link')?.attrs).href,
    );
    return href
      ? [new ExternalHyperlink({ link: href, children: textRuns })]
      : textRuns;
  }
  return Array.isArray(node.content)
    ? node.content.flatMap((child) => runs(object(child), size, bold))
    : [];
}
function upperCaseNode(node: MeditationJson): MeditationJson {
  return {
    ...node,
    ...(typeof node.text === 'string' ? { text: node.text.toUpperCase() } : {}),
    ...(Array.isArray(node.content)
      ? { content: node.content.map((value) => upperCaseNode(object(value))) }
      : {}),
  };
}
/** Saved verses may carry the model's quotes inside the layout's own. */
function singleQuotedNode(node: MeditationJson): MeditationJson {
  return {
    ...node,
    ...(typeof node.text === 'string'
      ? {
          text: node.text
            .replace(/[“"]{2,}/g, '“')
            .replace(/[”"]{2,}/g, '”')
            .replace(/“"/g, '“')
            .replace(/"”/g, '”'),
        }
      : {}),
    ...(Array.isArray(node.content)
      ? {
          content: node.content.map((value) => singleQuotedNode(object(value))),
        }
      : {}),
  };
}
export function meditationRichParagraphs(
  document: MeditationJson | undefined,
  field: string,
  fallback: string,
  size: number,
  center = false,
  prefix = '',
  bold = false,
): Array<Paragraph | Table> {
  const nodes = meditationRichNodes(document, field);
  const source = nodes.length
    ? nodes
    : [{ type: 'paragraph', content: [{ type: 'text', text: fallback }] }];
  const blocks = (node: MeditationJson): MeditationJson[] => {
    if (node.type === 'bulletList' || node.type === 'orderedList')
      return (Array.isArray(node.content) ? node.content : []).flatMap(
        (item, index) =>
          blocks(object(item)).map((block) => ({
            ...block,
            listPrefix: node.type === 'bulletList' ? '• ' : `${index + 1}. `,
          })),
      );
    if (node.type === 'blockquote')
      return (Array.isArray(node.content) ? node.content : [])
        .flatMap((item) => blocks(object(item)))
        .map((block) => ({ ...block, quote: true }));
    if (node.type === 'listItem')
      return (Array.isArray(node.content) ? node.content : []).flatMap((item) =>
        blocks(object(item)),
      );
    return [node];
  };
  return source.flatMap(blocks).map((node, index) => {
    const attrs = object(node.attrs);
    const headingLevel =
      field === 'title'
        ? attrs.meditationRichType === 'heading'
          ? Number(attrs.meditationHeadingLevel)
          : 0
        : node.type === 'heading'
          ? Number(attrs.level)
          : 0;
    const actualSize = Math.round(
      size * (MEDITATION_HEADING_SCALE[headingLevel] ?? 1),
    );
    if (node.type === 'table') {
      const rows = Array.isArray(node.content) ? node.content.map(object) : [];
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map(
          (row) =>
            new TableRow({
              children: (Array.isArray(row.content) ? row.content : []).map(
                (raw) => {
                  const cell = object(raw);
                  const cellAttrs = object(cell.attrs);
                  return new TableCell({
                    columnSpan: Math.max(1, Number(cellAttrs.colspan) || 1),
                    rowSpan: Math.max(1, Number(cellAttrs.rowspan) || 1),
                    ...(cell.type === 'tableHeader'
                      ? { shading: { fill: 'EEEEEE' } }
                      : {}),
                    children: meditationRichParagraphs(
                      {
                        content: [
                          ...(Array.isArray(cell.content)
                            ? cell.content.map((value) => ({
                                ...object(value),
                                attrs: {
                                  ...object(object(value).attrs),
                                  meditationField: 'firstActivity',
                                },
                              }))
                            : []),
                        ],
                      },
                      'activity1',
                      '',
                      size,
                    ),
                  });
                },
              ),
            }),
        ),
      });
    }
    if (node.type === 'horizontalRule')
      return new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '777777' },
        },
      });
    const lineHeight =
      typeof attrs.lineHeight === 'string'
        ? Number.parseFloat(attrs.lineHeight)
        : 1.2;
    const align = attrs.textAlign;
    const alignment =
      align === 'center'
        ? AlignmentType.CENTER
        : align === 'right'
          ? AlignmentType.RIGHT
          : align === 'justify'
            ? AlignmentType.JUSTIFIED
            : center
              ? AlignmentType.CENTER
              : AlignmentType.LEFT;
    return new Paragraph({
      alignment,
      spacing: {
        before: 0,
        after: 0,
        line: Math.round(
          actualSize *
            10 *
            (Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1.2),
        ),
      },
      ...(node.quote
        ? {
            indent: { left: 180 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 12, color: 'CCCCCC' },
            },
          }
        : {}),
      children: [
        new TextRun({
          text: sanitizeDocxText(
            `${index === 0 ? prefix : ''}${typeof node.listPrefix === 'string' ? node.listPrefix : ''}`,
          ),
          size,
          font: L.font,
        }),
        ...runs(
          field === 'title'
            ? upperCaseNode(node)
            : field === 'verseText'
              ? singleQuotedNode(node)
              : node,
          actualSize,
          bold || Boolean(headingLevel),
        ),
      ],
    });
  });
}

export function extractMeditationSectionText(
  document: MeditationJson,
  heading: string,
): string | null {
  const nodes = Array.isArray(document.content)
    ? document.content.map(object)
    : [];
  const index = nodes.findIndex(
    (node) =>
      node.type === 'heading' &&
      !object(node.attrs).meditationField &&
      meditationNodeText(node).trim().toUpperCase() === heading,
  );
  if (index < 0) return null;
  const remaining = nodes.slice(index + 1);
  const end = remaining.findIndex(
    (node) => node.type === 'heading' && !object(node.attrs).meditationField,
  );
  return (end < 0 ? remaining : remaining.slice(0, end))
    .map(meditationNodeText)
    .join('\n');
}
