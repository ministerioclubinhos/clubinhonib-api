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
import { OLDER_MEDITATION_MAX_ACTIVITIES } from '../constants/lesson-document.constants';
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
  meditationTitleBlocks,
  prayerTable,
  framedSheet,
  verseLabelCell,
} from './meditation-layout.utils';

export function buildOlderMeditationSheet(
  sheet: OlderMeditationSheet,
): Array<Paragraph | Table> {
  // Everything sits inside the frame cell: wider content hides the right border.
  const width = L.width - 2 * O.frameSideMargin - O.frameBorderAllowance;
  const { fontSize, imageHeight, weights, activitySpace, fits } =
    fitOlderMeditationSheet(sheet);
  if (!fits)
    throw new UnprocessableEntityException(
      'O conteúdo da meditação dos maiores não cabe em uma página legível. Reduza os textos ou as artes e visualize novamente.',
    );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const bannerWidth = Math.min(6500, width - 2700 - 180);
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
                        bannerWidth,
                        L.black,
                      ),
                    ],
                  }),
                  new TableRow({
                    children: [
                      cell(
                        meditationTitleBlocks(sheet.document, sheet.title, 24),
                        bannerWidth,
                      ),
                    ],
                  }),
                ],
                [bannerWidth],
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
          verseLabelCell(3250),
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
            verticalAlign: VerticalAlign.CENTER,
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
    new Paragraph({ spacing: { before: 0, after: 0, line: 100 } }),
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
      sheet.activities.slice(0, OLDER_MEDITATION_MAX_ACTIVITIES).map(
        (activity, index) =>
          new TableRow({
            cantSplit: true,
            height: {
              value: Math.floor(
                Math.max(
                  weights[index],
                  (activitySpace * O.activityFillShare * weights[index]) /
                    totalWeight,
                ),
              ),
              rule: HeightRule.ATLEAST,
            },
            children: [
              new TableCell({
                width: { size: width, type: WidthType.DXA },
                // A thin rule separates the blocks, as in the printed models.
                borders: {
                  ...noBorders,
                  ...(index
                    ? {
                        top: {
                          style: BorderStyle.SINGLE,
                          size: 6,
                          color: L.black,
                        },
                      }
                    : {}),
                },
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
                                Math.floor(width * O.textColumnShare),
                              ),
                              cell(
                                [
                                  imageParagraph(
                                    activity.image,
                                    (width * O.imageColumnShare) /
                                      O.twipsPerPixel,
                                    imageHeight,
                                  ),
                                ],
                                Math.ceil(width * O.imageColumnShare),
                              ),
                            ],
                          }),
                        ],
                        [
                          Math.floor(width * O.textColumnShare),
                          Math.ceil(width * O.imageColumnShare),
                        ],
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
  return [
    framedSheet(
      children,
      prayerTable(
        meditationRichParagraphs(
          sheet.document,
          'prayer',
          sheet.prayer,
          fontSize,
        ),
        2900,
        width,
        L.olderPrayerLabel,
        20,
      ),
      L.width,
      O.height - O.footerReserve,
      false,
      O.frameSideMargin,
    ),
  ];
}
