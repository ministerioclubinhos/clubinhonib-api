import { UnprocessableEntityException } from '@nestjs/common';
import {
  meditationNodeText,
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
import { youngerVerseParagraphs } from './younger-meditation-layout.utils';
import {
  OLDER_MEDITATION_LAYOUT as O,
  OLDER_MEDITATION_REFERENCE_ONLY,
} from '../constants/older-meditation-layout.constants';
import { OLDER_MEDITATION_MAX_ACTIVITIES } from '../constants/lesson-document.constants';
import type { OlderMeditationSheet } from '../types/older-meditation.types';
import { olderMeditationActivityBlocks } from './older-meditation-activity.utils';
import { fitOlderMeditationSheet } from './older-meditation-fit.utils';
import {
  table,
  cell,
  paragraph,
  text,
  imageParagraph,
  noBorders,
  meditationTitleBlocks,
  prayerTable,
  framedSheet,
  verseLabelCell,
} from './meditation-layout.utils';

/**
 * Os relatos estudados, sem rótulo nem parênteses: a folha os imprime entre
 * parênteses logo abaixo do tema, como nos modelos feitos à mão.
 */
export function olderMeditationSubtitle(sheet: OlderMeditationSheet): string {
  const nodes = meditationRichNodes(sheet.document, 'biblicalText');
  const value = nodes.length
    ? nodes.map(meditationNodeText).join(' ')
    : sheet.biblicalText;
  return value
    .replace(/\s+/g, ' ')
    .replace(/^\s*TEXTO BÍBLICO\s*:?\s*/i, '')
    .trim()
    .replace(/^\((.*)\)[\s.]*$/s, '$1')
    .trim();
}

function olderMeditationTitleBlocks(
  sheet: OlderMeditationSheet,
): Array<Paragraph | Table> {
  const blocks = meditationTitleBlocks(sheet.document, sheet.title, 24);
  const subtitle = olderMeditationSubtitle(sheet);
  // A title that already carries "(...)" prints its own subtitle.
  if (!subtitle || /\(.+\)[\s.]*$/s.test(sheet.title.trim())) return blocks;
  // Story names go between parentheses; a bare Bible reference is labelled,
  // as in the printed sheets ("TEXTO BÍBLICO: Lc 15.11-32").
  return [
    ...blocks,
    paragraph(
      [
        text(
          OLDER_MEDITATION_REFERENCE_ONLY.test(subtitle)
            ? `TEXTO BÍBLICO: ${subtitle.replace(/[\s.]+$/, '')}`
            : `(${subtitle})`,
          22,
        ),
      ],
      true,
    ),
  ];
}

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
                      cell(olderMeditationTitleBlocks(sheet), bannerWidth),
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
            // As in the printed sheets: the verse, then "(Reference – NVI)".
            children: youngerVerseParagraphs(sheet.verse, 22),
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
    paragraph([text('Entendendo a lição:', fontSize, true)]),
    // The context lives inside each question; the intro is printed only when written.
    ...(sheet.introduction.trim() ||
    meditationRichNodes(sheet.document, 'introduction').some((node) =>
      meditationNodeText(node).trim(),
    )
      ? meditationRichParagraphs(
          sheet.document,
          'introduction',
          sheet.introduction,
          fontSize,
        )
      : []),
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
