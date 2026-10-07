import {
  meditationRichNodes,
  meditationRichParagraphs,
} from './meditation-rich-text.utils';
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
import { OLDER_MEDITATION_LAYOUT as O } from '../constants/older-meditation-layout.constants';
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
  const imageCount = sheet.activities.filter(
    (activity) => activity.image,
  ).length;
  const fontSize =
    length > 4500
      ? 18
      : length > 3000 || (imageCount >= 2 && length > 2300)
        ? 20
        : 22;
  const imageHeight = length > 4500 ? 180 : 230;
  const weights = sheet.activities.slice(0, 3).map((activity) => {
    const columns = activity.image ? 58 : 100;
    const lines = activity.instruction
      .split(/\r?\n/)
      .reduce(
        (sum, line) => sum + Math.max(1, Math.ceil(line.length / columns)),
        0,
      );
    return Math.max(lines * 18 + 45, activity.image ? 230 : 140);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
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
                          ...meditationRichParagraphs(
                            sheet.document,
                            'title',
                            sheet.title.toUpperCase(),
                            24,
                            true,
                            '',
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
            children: meditationRichNodes(sheet.document, 'verseText').length
              ? [
                  ...meditationRichParagraphs(
                    sheet.document,
                    'verseText',
                    '',
                    22,
                    true,
                  ),
                  ...meditationRichParagraphs(
                    sheet.document,
                    'verseReference',
                    '',
                    22,
                    true,
                  ),
                ]
              : [paragraph(textLines(sheet.verse, 22), true)],
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
    ...meditationRichParagraphs(
      sheet.document,
      'biblicalText',
      sheet.biblicalText,
      fontSize,
      false,
      'TEXTO BÍBLICO: ',
    ),
    paragraph([text('Entendendo a lição:', fontSize, true)]),
    ...meditationRichParagraphs(
      sheet.document,
      'introduction',
      sheet.introduction,
      fontSize,
    ),
  ];
  const introductionLines = Math.ceil(
    sheet.introduction.length / O.introductionColumns,
  );
  const extraTitleLines = Math.max(
    0,
    Math.ceil(sheet.title.length / O.titleColumns) - 2,
  );
  const extraVerseLines = Math.max(
    0,
    Math.ceil(sheet.verse.length / O.verseColumns) - 2,
  );
  const extraPrayerLines = Math.max(0, Math.ceil(sheet.prayer.length / 70) - 2);
  const activitySpace =
    O.height -
    O.headerReserve -
    O.footerReserve -
    O.tableReserve -
    introductionLines * fontSize * O.lineHeight -
    extraTitleLines * 24 * O.lineHeight -
    extraVerseLines * 22 * O.lineHeight -
    extraPrayerLines * fontSize * O.lineHeight;
  children.push(
    table(
      sheet.activities.slice(0, 3).map(
        (activity, index) =>
          new TableRow({
            cantSplit: true,
            height: {
              value: Math.floor((activitySpace * weights[index]) / totalWeight),
              rule: HeightRule.ATLEAST,
            },
            children: [
              new TableCell({
                width: { size: width, type: WidthType.DXA },
                borders: noBorders,
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 60, bottom: 60, left: 60, right: 60 },
                children: activity.image
                  ? [
                      table(
                        [
                          new TableRow({
                            children: [
                              cell(
                                meditationRichParagraphs(
                                  sheet.document,
                                  `activity${index + 1}`,
                                  activity.instruction,
                                  fontSize,
                                  false,
                                  `${index + 1}. `,
                                ),
                                Math.floor(width * 0.58),
                              ),
                              cell(
                                [
                                  imageParagraph(
                                    activity.image,
                                    (width * 0.42) / 15,
                                    imageHeight,
                                  ),
                                ],
                                Math.ceil(width * 0.42),
                              ),
                            ],
                          }),
                        ],
                        [Math.floor(width * 0.58), Math.ceil(width * 0.42)],
                      ),
                    ]
                  : [
                      ...meditationRichParagraphs(
                        sheet.document,
                        `activity${index + 1}`,
                        activity.instruction,
                        fontSize,
                        false,
                        `${index + 1}. `,
                      ),
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
              meditationRichParagraphs(
                sheet.document,
                'prayer',
                sheet.prayer,
                fontSize,
              ),
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
          height: { value: O.height, rule: HeightRule.EXACT },
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
