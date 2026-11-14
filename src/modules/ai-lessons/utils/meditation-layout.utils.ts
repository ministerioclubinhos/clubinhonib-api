import {
  AlignmentType,
  BorderStyle,
  HeightRule,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { YOUNGER_MEDITATION_LAYOUT as L } from '../constants/younger-meditation-layout.constants';
import {
  DOCUMENT_DEFAULT_COLOR,
  DOCUMENT_FALLBACK_IMAGE_RATIO,
} from '../constants/lesson-document.constants';
import { docxTextLines, sanitizeDocxText } from './docx-text.utils';
import { fitImageInBox } from './image-dimensions.utils';
import type { MeditationJson } from '../types/younger-meditation.types';
import {
  meditationRichNodes,
  meditationRichParagraphs,
} from './meditation-rich-text.utils';
const noBorder = { style: BorderStyle.NONE };
export const noBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
  insideHorizontal: noBorder,
  insideVertical: noBorder,
};

export function text(
  text: string,
  size: number = L.textSize,
  bold = false,
  color: string = DOCUMENT_DEFAULT_COLOR,
  italics = false,
): TextRun {
  return new TextRun({
    text: sanitizeDocxText(text),
    font: L.font,
    size,
    bold,
    color,
    italics,
  });
}

export function textLines(value: string, size: number): TextRun[] {
  return docxTextLines(value).map(
    (line, index) =>
      new TextRun({
        text: line,
        font: L.font,
        size,
        ...(index ? { break: 1 } : {}),
      }),
  );
}

export function paragraph(children: TextRun[], center = false): Paragraph {
  return new Paragraph({
    children,
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: 0, after: 0, line: 240 },
  });
}

export function cell(
  children: Array<Paragraph | Table>,
  width: number,
  fill?: string,
): TableCell {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    borders: noBorders,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    verticalAlign: VerticalAlign.CENTER,
    ...(fill ? { shading: { fill } } : {}),
  });
}

export function table(rows: TableRow[], widths: number[]): Table {
  return new Table({
    rows,
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    width: {
      size: widths.reduce((sum, width) => sum + width, 0),
      type: WidthType.DXA,
    },
    borders: noBorders,
  });
}

/** Image scaled to fit the box with its real proportions and container type. */
export function imageParagraph(
  data: Buffer,
  maxWidth: number,
  maxHeight: number,
): Paragraph {
  const { width, height, type } = fitImageInBox(
    data,
    { width: maxWidth, height: maxHeight },
    DOCUMENT_FALLBACK_IMAGE_RATIO,
  );
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 20, after: 0 },
    children: [new ImageRun({ data, type, transformation: { width, height } })],
  });
}

const solid = (size: number) => ({
  style: BorderStyle.SINGLE,
  size,
  color: L.black,
});

/**
 * Sheet title as the printed models show it: the brand line, the theme in
 * bold capitals and, when the theme carries one, the parenthetical subtitle
 * on its own line in regular weight.
 */
export function meditationTitleBlocks(
  document: MeditationJson | undefined,
  title: string,
  size: number,
  withBrand = true,
): Array<Paragraph | Table> {
  const brand = paragraph([text(L.brand, size, true)], true);
  const head = withBrand ? [brand] : [];
  const nodes = meditationRichNodes(document, 'title');
  // A title nobody formatted is laid out like the printed models instead.
  const formatted =
    nodes.length > 1 || /"marks"|"textAlign"/.test(JSON.stringify(nodes));
  if (formatted)
    return [
      ...head,
      ...meditationRichParagraphs(
        document,
        'title',
        title,
        size,
        true,
        '',
        true,
      ),
    ];
  const match = /^(.*?)\s*(\(.+\))[\s.]*$/s.exec(title.trim());
  const main = (match ? match[1] : title).trim().replace(/[\s.]+$/, '');
  return [
    ...head,
    paragraph([text(main.toLocaleUpperCase('pt-BR'), size, true)], true),
    ...(match ? [paragraph([text(match[2], size - 2)], true)] : []),
  ];
}

/** "Versículo para decorar" tag: a compact yellow label, never as tall as the verse. */
export function verseLabelCell(width: number): TableCell {
  const inner = width - 180;
  return cell(
    [
      table(
        [
          new TableRow({
            children: [
              cell(
                [paragraph([text('Versículo para decorar', 24, true)], true)],
                inner,
                L.yellow,
              ),
            ],
          }),
        ],
        [inner],
      ),
    ],
    width,
  );
}

/** "FALANDO COM DEUS" strip closing the sheet: framed, label in dark bold text. */
export function prayerTable(
  prayer: Array<Paragraph | Table>,
  labelWidth: number,
  width: number,
  labelFill: string,
  labelSize: number,
  labelColor: string = DOCUMENT_DEFAULT_COLOR,
): Table {
  const framed = (
    children: Array<Paragraph | Table>,
    cellWidth: number,
    fill: string,
  ): TableCell =>
    new TableCell({
      children,
      width: { size: cellWidth, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 110, right: 110 },
      verticalAlign: VerticalAlign.CENTER,
      shading: { fill },
      borders: {
        top: solid(6),
        bottom: solid(6),
        left: solid(6),
        right: solid(6),
      },
    });
  return table(
    [
      new TableRow({
        cantSplit: true,
        children: [
          framed(
            [
              paragraph(
                [text('FALANDO COM DEUS:', labelSize, true, labelColor)],
                true,
              ),
            ],
            labelWidth,
            labelFill,
          ),
          framed(prayer, width - labelWidth, L.gray),
        ],
      }),
    ],
    [labelWidth, width - labelWidth],
  );
}

/**
 * Thick frame of a sheet in two rows: the body takes the given height and the
 * prayer strip always closes the sheet, whatever the body leaves unused.
 */
export function framedSheet(
  body: Array<Paragraph | Table>,
  prayer: Table,
  width: number,
  bodyHeight: number,
  exact: boolean,
  sideMargin: number,
): Table {
  const thick = solid(30);
  const frameCell = (
    children: Array<Paragraph | Table>,
    closing: boolean,
  ): TableCell =>
    new TableCell({
      margins: {
        top: closing ? 0 : 60,
        bottom: closing ? 60 : 0,
        left: sideMargin,
        right: sideMargin,
      },
      verticalAlign: closing ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
      borders: {
        left: thick,
        right: thick,
        top: closing ? noBorder : thick,
        bottom: closing ? thick : noBorder,
      },
      children,
    });
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [
      new TableRow({
        cantSplit: true,
        height: {
          value: bodyHeight,
          rule: exact ? HeightRule.EXACT : HeightRule.ATLEAST,
        },
        children: [frameCell(body, false)],
      }),
      new TableRow({
        cantSplit: true,
        children: [frameCell([prayer], true)],
      }),
    ],
  });
}
