import { UnprocessableEntityException } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { MANUAL_WORK_LAYOUT as L } from '../constants/manual-work-layout.constants';
import { docxTextLines } from './docx-text.utils';
import { imageParagraph, noBorders } from './meditation-layout.utils';

/** One unsplittable row keeps the two copies together; image space is reserved after the verse. */
export function buildManualWorkSheet(
  image: Buffer,
  logo: Buffer,
  verse: string,
): Table[] {
  const lines = verse
    .split(/\r?\n/)
    .reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(line.length / L.verseColumns)),
      0,
    );
  const imageHeight = Math.min(
    L.imageMaximumHeight,
    Math.floor(
      (L.halfHeight -
        L.headerReserve -
        L.copyReserve -
        lines * L.verseLineHeight) /
        L.twipsPerPixel,
    ),
  );
  if (imageHeight < L.imageMinimumHeight)
    throw new UnprocessableEntityException(
      'O versículo do trabalho manual excede o espaço das duas cópias na mesma página. Revise o texto antes de exportar.',
    );
  const copyContent = (): Paragraph[] => [
    imageParagraph(logo, L.logoWidth, L.logoHeight),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40, line: 240 },
      children: [
        new TextRun({ text: 'TRABALHO MANUAL', bold: true, size: 20 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40, line: L.verseLineHeight },
      children: docxTextLines(verse).map(
        (line, index) =>
          new TextRun({
            text: line,
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
          children: [
            new TableCell({
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
