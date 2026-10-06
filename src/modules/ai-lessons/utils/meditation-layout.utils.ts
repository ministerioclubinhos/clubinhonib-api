import {
  AlignmentType,
  BorderStyle,
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
  color = '000000',
): TextRun {
  return new TextRun({ text, font: L.font, size, bold, color });
}

export function textLines(value: string, size: number): TextRun[] {
  return value.split(/\r?\n/).map(
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

export function imageParagraph(
  data: Buffer,
  maxWidth: number,
  maxHeight: number,
): Paragraph {
  const png = data.length >= 24 && data.subarray(1, 4).toString() === 'PNG';
  const ratio = png ? data.readUInt32BE(16) / data.readUInt32BE(20) : 1.5;
  const width = Math.min(maxWidth, maxHeight * ratio);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 20, after: 0 },
    children: [
      new ImageRun({
        data,
        type: 'png',
        transformation: { width, height: width / ratio },
      }),
    ],
  });
}
