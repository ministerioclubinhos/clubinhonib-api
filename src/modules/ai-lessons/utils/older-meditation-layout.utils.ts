import {
  BorderStyle,
  HeightRule,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  VerticalAlign,
} from 'docx';
import { YOUNGER_MEDITATION_LAYOUT as L } from '../constants/younger-meditation-layout.constants';
import type { OlderMeditationSheet } from '../types/older-meditation.types';
import {
  table,
  cell,
  paragraph,
  text,
  textLines,
  imageParagraph,
  noBorders,
} from './meditation-layout.utils';

export function buildOlderMeditationSheet(
  sheet: OlderMeditationSheet,
): Array<Paragraph | Table> {
  const width = L.width - 180;
  const length =
    sheet.introduction.length +
    sheet.activities.reduce((sum, item) => sum + item.instruction.length, 0);
  const fontSize = length > 4500 ? 18 : length > 3000 ? 20 : 22;
  const imageHeight = length > 2500 ? 100 : 140;
  const header = table(
    [
      new TableRow({
        cantSplit: true,
        children: [
          cell([imageParagraph(sheet.logo, 170, 80)], 2700),
          cell(
            [
              table(
                [
                  new TableRow({
                    children: [
                      cell(
                        [
                          paragraph(
                            [
                              text(
                                'MEDITAÇÃO PARA CRIANÇAS MAIORES',
                                24,
                                true,
                                'FFFFFF',
                              ),
                            ],
                            true,
                          ),
                        ],
                        6500,
                        L.black,
                      ),
                    ],
                  }),
                  new TableRow({
                    children: [
                      cell(
                        [
                          paragraph(
                            [text(sheet.title.toUpperCase(), 24, true)],
                            true,
                          ),
                        ],
                        6500,
                      ),
                    ],
                  }),
                ],
                [6500],
              ),
            ],
            width - 2700,
          ),
        ],
      }),
    ],
    [2700, width - 2700],
  );
  const verse = table(
    [
      new TableRow({
        children: [
          cell(
            [paragraph([text('Versículo para decorar', 24, true)])],
            3250,
            L.yellow,
          ),
          cell([paragraph([text('❯', 46, true, 'ED1C24')], true)], 430),
          new TableCell({
            children: [paragraph(textLines(sheet.verse, 22), true)],
            width: { size: width - 3680, type: WidthType.DXA },
            margins: { top: 70, bottom: 70, left: 90, right: 90 },
            borders: Object.fromEntries(
              ['top', 'bottom', 'left', 'right'].map((side) => [
                side,
                { style: BorderStyle.DASHED, size: 20, color: L.black },
              ]),
            ),
          }),
        ],
      }),
    ],
    [3250, 430, width - 3680],
  );
  const children: Array<Paragraph | Table> = [
    header,
    paragraph([
      text(
        'Nome: _______________________________________________________    Data: ____/____/____',
        22,
      ),
    ]),
    verse,
    paragraph([
      text('TEXTO BÍBLICO: ', fontSize, true),
      text(sheet.biblicalText, fontSize),
    ]),
    paragraph([text('Entendendo a lição:', fontSize, true)]),
    paragraph(textLines(sheet.introduction, fontSize)),
  ];
  const introductionLines = Math.ceil(sheet.introduction.length / 100);
  const activityHeight = Math.max(
    2000,
    Math.floor((15400 - 4000 - introductionLines * fontSize * 10) / 3),
  );
  children.push(
    table(
      sheet.activities.slice(0, 3).map(
        (activity, index) =>
          new TableRow({
            cantSplit: true,
            height: { value: activityHeight, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                width: { size: width, type: WidthType.DXA },
                borders: noBorders,
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 60, bottom: 60, left: 60, right: 60 },
                children: [
                  paragraph(
                    textLines(
                      `${index + 1}. ${activity.instruction}`,
                      fontSize,
                    ),
                  ),
                  ...(activity.image
                    ? [imageParagraph(activity.image, 650, imageHeight)]
                    : [
                        paragraph([
                          text(
                            '________________________________________________________________________________',
                            fontSize,
                          ),
                        ]),
                        paragraph([
                          text(
                            '________________________________________________________________________________',
                            fontSize,
                          ),
                        ]),
                      ]),
                ],
              }),
            ],
          }),
      ),
      [width],
    ),
  );
  children.push(
    table(
      [
        new TableRow({
          children: [
            cell(
              [paragraph([text('FALANDO COM DEUS:', 20, true, 'FFFFFF')])],
              2900,
              L.prayerLabel,
            ),
            cell(
              [paragraph(textLines(sheet.prayer, fontSize))],
              width - 2900,
              L.gray,
            ),
          ],
        }),
      ],
      [2900, width - 2900],
    ),
  );
  return [
    new Table({
      width: { size: L.width, type: WidthType.DXA },
      columnWidths: [L.width],
      borders: noBorders,
      rows: [
        new TableRow({
          cantSplit: true,
          height: { value: 15400, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              margins: { top: 60, bottom: 60, left: 60, right: 60 },
              borders: Object.fromEntries(
                ['top', 'bottom', 'left', 'right'].map((side) => [
                  side,
                  { style: BorderStyle.SINGLE, size: 30, color: L.black },
                ]),
              ),
              children,
            }),
          ],
        }),
      ],
    }),
  ];
}
