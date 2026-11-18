import { UnprocessableEntityException } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  HeightRule,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { MANUAL_WORK_LAYOUT as L } from '../constants/manual-work-layout.constants';
import { docxTextLines } from './docx-text.utils';
import {
  cell,
  imageParagraph,
  noBorders,
  table,
} from './meditation-layout.utils';

/** The verse as the handmade sheets print it: in capitals. */
export function manualWorkVerse(verse: string): string {
  return verse.toLocaleUpperCase('pt-BR');
}

/**
 * Height, in pixels, left for the artwork of one copy below this verse: the
 * artwork always spans the full width of the frame.
 */
export function manualWorkImageHeight(verse: string): number {
  const lines = manualWorkVerse(verse)
    .split(/\r?\n/)
    .reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(line.length / L.verseColumns)),
      0,
    );
  return Math.min(
    L.imageMaximumHeight,
    Math.floor(
      (L.halfHeight -
        L.headerReserve -
        L.copyReserve -
        lines * L.verseLineHeight) /
        L.twipsPerPixel,
    ),
  );
}

/** One unsplittable row keeps the two copies together; image space is reserved after the verse. */
export function buildManualWorkSheet(
  image: Buffer,
  logo: Buffer,
  verse: string,
): Table[] {
  const imageHeight = manualWorkImageHeight(verse);
  if (imageHeight < L.imageMinimumHeight)
    throw new UnprocessableEntityException(
      'O versículo do trabalho manual excede o espaço das duas cópias na mesma página. Revise o texto antes de exportar.',
    );
  // As in the handmade sheets: the logo on the left and the black band
  // "TRABALHO MANUAL" centred on the copy, over the verse in bold capitals.
  const sideWidth = Math.floor(
    (L.width - 2 * L.framePadding - L.bandWidth) / 2,
  );
  const blank = (width: number): TableCell =>
    cell([new Paragraph({ children: [] })], width);
  const copyContent = (): Array<Paragraph | Table> => [
    table(
      [
        new TableRow({
          cantSplit: true,
          children: [
            cell([imageParagraph(logo, L.logoWidth, L.logoHeight)], sideWidth),
            cell(
              [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0, line: 240 },
                  children: [
                    new TextRun({
                      text: 'TRABALHO MANUAL',
                      bold: true,
                      font: L.font,
                      size: L.bandSize,
                      color: L.bandColor,
                    }),
                  ],
                }),
              ],
              L.bandWidth,
              L.bandFill,
            ),
            blank(sideWidth),
          ],
        }),
      ],
      [sideWidth, L.bandWidth, sideWidth],
    ),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60, line: L.verseLineHeight },
      children: docxTextLines(manualWorkVerse(verse)).map(
        (line, index) =>
          new TextRun({
            text: line,
            bold: true,
            font: L.font,
            size: L.verseSize,
            ...(index ? { break: 1 } : {}),
          }),
      ),
    }),
    imageParagraph(image, L.imageMaximumWidth, imageHeight),
  ];
  const copy = (): Table[] => [
    new Table({
      width: { size: L.width, type: WidthType.DXA },
      columnWidths: [L.width],
      borders: noBorders,
      rows: [
        new TableRow({
          cantSplit: true,
          // Both copies take the same half of the page, whatever the art.
          height: { value: L.halfHeight, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              verticalAlign: VerticalAlign.CENTER,
              borders: Object.fromEntries(
                ['top', 'bottom', 'left', 'right'].map((side) => [
                  side,
                  {
                    style: BorderStyle.SINGLE,
                    color: '000000',
                    size: L.frameBorderSize,
                  },
                ]),
              ),
              margins: {
                top: L.framePadding,
                bottom: L.framePadding,
                left: L.framePadding,
                right: L.framePadding,
              },
              children: copyContent(),
            }),
          ],
        }),
      ],
    }),
  ];
  return [
    new Table({
      width: { size: L.width, type: WidthType.DXA },
      columnWidths: [L.width],
      borders: noBorders,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: L.width, type: WidthType.DXA },
              borders: noBorders,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [
                ...copy(),
                new Paragraph({
                  spacing: { before: 80, after: 80, line: 120 },
                  border: {
                    bottom: {
                      style: BorderStyle.DASHED,
                      color: '777777',
                      size: 8,
                    },
                  },
                  children: [new TextRun({ text: '', size: 2 })],
                }),
                ...copy(),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}
