import {
  meditationRichNodes,
  meditationRichParagraphs,
} from './meditation-rich-text.utils';
import { youngerMeditationFit } from './younger-meditation-fit.utils';
import {
  BorderStyle,
  HeightRule,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  VerticalAlign,
  WidthType,
} from 'docx';
import { UnprocessableEntityException } from '@nestjs/common';
import { YOUNGER_MEDITATION_LAYOUT as L } from '../constants/younger-meditation-layout.constants';
import { YOUNGER_MEDITATION_MAX_ACTIVITIES } from '../constants/lesson-document.constants';
import type {
  YoungerMeditationFit,
  YoungerMeditationSheet,
} from '../types/younger-meditation.types';

import {
  noBorders,
  text,
  textLines,
  paragraph,
  cell,
  table,
  imageParagraph,
  meditationTitleBlocks,
  prayerTable,
  framedSheet,
  verseLabelCell,
} from './meditation-layout.utils';

export function buildYoungerMeditationCopy(
  sheet: YoungerMeditationSheet,
  fit: YoungerMeditationFit = youngerMeditationFit(sheet),
): Table {
  const innerWidth = L.width - 180;
  const logoWidth = 2700;
  const headingWidth = innerWidth - logoWidth;
  const bannerWidth = 5400;
  const header = table(
    [
      new TableRow({
        cantSplit: true,
        children: [
          cell([imageParagraph(sheet.logo, 170, 70)], logoWidth),
          cell(
            [
              table(
                [
                  new TableRow({
                    cantSplit: true,
                    children: [
                      cell(
                        [
                          paragraph(
                            [
                              text(
                                'MEDITAÇÃO PARA CRIANÇAS MENORES',
                                23,
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
                    cantSplit: true,
                    children: [
                      cell(
                        meditationTitleBlocks(
                          sheet.document,
                          sheet.title,
                          fit.titleSize,
                        ),
                        bannerWidth,
                      ),
                    ],
                  }),
                ],
                [bannerWidth],
              ),
            ],
            headingWidth,
          ),
        ],
      }),
    ],
    [logoWidth, headingWidth],
  );
  const verse = table(
    [
      new TableRow({
        cantSplit: true,
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
                    fit.verseSize,
                    true,
                  ),
                  ...meditationRichParagraphs(
                    sheet.document,
                    'verseReference',
                    '',
                    fit.verseSize,
                    true,
                  ),
                ]
              : [paragraph(textLines(sheet.verse, fit.verseSize), true)],
            width: { size: innerWidth - 3680, type: WidthType.DXA },
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
    [3250, 430, innerWidth - 3680],
  );
  const activityWidth = Math.floor(innerWidth / 2);
  const activities = table(
    [
      new TableRow({
        cantSplit: true,
        height: { value: fit.activityRowHeight, rule: HeightRule.ATLEAST },
        children: sheet.activities
          .slice(0, YOUNGER_MEDITATION_MAX_ACTIVITIES)
          .map(
            (activity, index) =>
              new TableCell({
                width: { size: activityWidth, type: WidthType.DXA },
                margins: { top: 70, bottom: 0, left: 130, right: 130 },
                verticalAlign: VerticalAlign.TOP,
                borders: {
                  ...noBorders,
                  ...(index === 0
                    ? {
                        right: {
                          style: BorderStyle.SINGLE,
                          size: 6,
                          color: L.black,
                        },
                      }
                    : {}),
                },
                children: [
                  ...(index === 0
                    ? [paragraph([text(L.lessonHeading, fit.textSize, true)])]
                    : []),
                  ...meditationRichParagraphs(
                    sheet.document,
                    `activity${index + 1}`,
                    activity.instruction,
                    fit.textSize,
                    false,
                    `${index + 1}. `,
                  ),
                  ...(activity.image
                    ? [
                        imageParagraph(
                          activity.image,
                          L.imageMaximumWidth,
                          fit.imageHeight,
                        ),
                      ]
                    : []),
                ],
              }),
          ),
      }),
    ],
    [activityWidth, activityWidth],
  );
  const prayer = prayerTable(
    meditationRichParagraphs(
      sheet.document,
      'prayer',
      sheet.prayer,
      fit.textSize,
    ),
    2650,
    innerWidth,
    L.yellow,
    19,
  );
  return framedSheet(
    [
      header,
      table(
        [
          new TableRow({
            children: [
              cell(
                [
                  paragraph([
                    text(
                      'Nome: _________________________________________________________',
                      20,
                    ),
                  ]),
                ],
                8200,
              ),
              cell(
                [paragraph([text('Data: ____/____/____', 20)])],
                innerWidth - 8200,
              ),
            ],
          }),
        ],
        [8200, innerWidth - 8200],
      ),
      verse,
      activities,
    ],
    prayer,
    L.width,
    L.halfHeight - fit.prayerHeight,
    true,
    60,
  );
}

export function buildYoungerMeditationSheet(
  sheet: YoungerMeditationSheet,
): Array<Paragraph | Table> {
  // Each copy has a fixed height so both stay on one page; content that does
  // not fit would be silently cut, so it is rejected like the older sheet.
  const fit = youngerMeditationFit(sheet);
  if (!fit.fits)
    throw new UnprocessableEntityException(
      'O conteúdo da meditação dos menores não cabe nas duas cópias da folha. Reduza os textos das atividades, do versículo ou da oração e visualize novamente.',
    );
  return [
    buildYoungerMeditationCopy(sheet, fit),
    new Paragraph({
      spacing: { before: 0, after: 0, line: L.gap },
      children: [text(' ', 2)],
    }),
    buildYoungerMeditationCopy(sheet, fit),
  ];
}
