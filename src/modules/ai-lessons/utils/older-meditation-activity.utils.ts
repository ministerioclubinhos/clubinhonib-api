import {
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
import type { MeditationJson } from '../types/younger-meditation.types';
import { OLDER_MEDITATION_LAYOUT as O } from '../constants/older-meditation-layout.constants';
import { MEDITATION_ACTIVITY_FIELDS } from '../constants/meditation-formatting.constants';
import { paragraph, table } from './meditation-layout.utils';
import {
  meditationNodeText,
  meditationRichNodes,
  meditationRichParagraphs,
} from './meditation-rich-text.utils';

function instructionLines(nodes: MeditationJson[]): MeditationJson[] {
  return nodes.flatMap((node) => {
    if (node.type !== 'paragraph' || !Array.isArray(node.content))
      return [node];
    const lines: MeditationJson[][] = [[]];
    for (const value of node.content as MeditationJson[]) {
      if (value.type === 'hardBreak') lines.push([]);
      else if (typeof value.text === 'string') {
        value.text.split(/\r?\n/).forEach((line, index) => {
          if (index) lines.push([]);
          lines[lines.length - 1].push({ ...value, text: line });
        });
      } else lines[lines.length - 1].push(value);
    }
    return lines.map((content) => ({ ...node, content }));
  });
}

/** Native square cells keep printed puzzle letters aligned independently of prose fonts. */
export function olderMeditationActivityBlocks(
  document: MeditationJson | undefined,
  index: number,
  instruction: string,
  size: number,
): Array<Paragraph | Table> {
  const field = `activity${index + 1}`;
  const richNodes = meditationRichNodes(document, field);
  const nodes = instructionLines(
    richNodes.length
      ? richNodes
      : [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: instruction }],
          },
        ],
  );
  const blocks: Array<Paragraph | Table> = [];
  let numbered = false;
  for (let cursor = 0; cursor < nodes.length; ) {
    let end = cursor;
    if (/caça[ -]palavras|cruzadinha/i.test(instruction)) {
      while (
        end < nodes.length &&
        /^[A-ZÀ-Ü0-9#._\s]{4,}$/.test(meditationNodeText(nodes[end]).trim())
      )
        end++;
    }
    if (end - cursor >= 3) {
      const rows = nodes.slice(cursor, end).map((node) =>
        meditationNodeText(node)
          .normalize('NFD')
          .replace(/[\u0300-\u036f\s]/g, '')
          .toUpperCase(),
      );
      if (rows.every((row) => row.length === rows[0].length)) {
        const side = Math.min(
          O.gridCellSize,
          size * O.lineHeight + O.gridPadding,
        );
        blocks.push(
          table(
            rows.map(
              (row) =>
                new TableRow({
                  cantSplit: true,
                  height: { value: side, rule: HeightRule.ATLEAST },
                  children: Array.from(row).map(
                    (letter) =>
                      new TableCell({
                        width: { size: side, type: WidthType.DXA },
                        margins: { top: 20, bottom: 20, left: 0, right: 0 },
                        verticalAlign: VerticalAlign.CENTER,
                        ...(letter === '#'
                          ? { shading: { fill: '252223' } }
                          : {}),
                        borders: Object.fromEntries(
                          ['top', 'bottom', 'left', 'right'].map((border) => [
                            border,
                            {
                              style: BorderStyle.SINGLE,
                              size: 2,
                              color: 'CCCCCC',
                            },
                          ]),
                        ),
                        children: [
                          paragraph(
                            [
                              new TextRun({
                                text: ['#', '.', '_'].includes(letter)
                                  ? ''
                                  : letter,
                                font: O.gridFont,
                                size: Math.min(O.gridFontSize, size),
                              }),
                            ],
                            true,
                          ),
                        ],
                      }),
                  ),
                }),
            ),
            Array.from({ length: rows[0].length }, () => side),
          ),
        );
        cursor = end;
        continue;
      }
    }
    const node = nodes[cursor];
    // The outer block number belongs to the command, never to its first subitem.
    const prefix =
      numbered || /^\s*\d+[.)]\s/.test(meditationNodeText(node))
        ? ''
        : `${index + 1}. `;
    blocks.push(
      ...meditationRichParagraphs(
        {
          content: [
            {
              ...node,
              attrs: {
                ...(node.attrs as MeditationJson | undefined),
                meditationField: MEDITATION_ACTIVITY_FIELDS[index],
              },
            },
          ],
        },
        field,
        '',
        size,
        false,
        prefix,
      ),
    );
    numbered = true;
    cursor++;
  }
  return blocks;
}
