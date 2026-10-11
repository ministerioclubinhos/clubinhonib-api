import { UnprocessableEntityException } from '@nestjs/common';
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
import { olderMeditationActivityBlocks } from './older-meditation-activity.utils';
import { fitOlderMeditationSheet } from './older-meditation-fit.utils';
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
  const { fontSize, imageHeight, weights, activitySpace, fits } =
    fitOlderMeditationSheet(sheet);
  if (!fits)
    throw new UnprocessableEntityException(
      'O conteúdo da meditação dos maiores não cabe em uma página legível. Reduza os textos ou as artes e visualize novamente.',
    );
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
  children.push(
    table(
      sheet.activities.slice(0, 3).map(
        (activity, index) =>
          new TableRow({
            cantSplit: true,
            height: {
              value: Math.floor(
                Math.min(
                  (activitySpace * weights[index]) / totalWeight,
                  weights[index] * O.maximumRowExpansion,
                ),
              ),
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
                                olderMeditationActivityBlocks(
                                  sheet.document,
                                  index,
                                  activity.instruction,
                                  fontSize,
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
                      ...olderMeditationActivityBlocks(
                        sheet.document,
                        index,
                        activity.instruction,
                        fontSize,
                      ),
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
          height: { value: O.height, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              verticalAlign: VerticalAlign.TOP,
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
