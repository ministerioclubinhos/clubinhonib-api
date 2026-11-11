import { UnprocessableEntityException } from '@nestjs/common';
import { isPuzzleGridBlock, isPuzzleGridRow } from './meditation-grid.utils';
import { olderMeditationRichHeight } from './older-meditation-measure.utils';
import { OLDER_MEDITATION_LAYOUT as O } from '../constants/older-meditation-layout.constants';
import { OLDER_MEDITATION_MAX_ACTIVITIES } from '../constants/lesson-document.constants';
import { YOUNGER_MEDITATION_LAYOUT as L } from '../constants/younger-meditation-layout.constants';
import type {
  OlderMeditationFit,
  OlderMeditationSheet,
} from '../types/older-meditation.types';

function wrappedLines(value: string, columns: number): number {
  return value
    .split(/\r?\n/)
    .reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(line.length / columns)),
      0,
    );
}

export function fitOlderMeditationSheet(
  sheet: OlderMeditationSheet,
): OlderMeditationFit {
  const width = L.width - 180;
  const length =
    sheet.introduction.length +
    sheet.activities.reduce((sum, item) => sum + item.instruction.length, 0);
  const imageCount = sheet.activities.filter(
    (activity) => activity.image,
  ).length;
  const initialSize =
    length > O.denseTextLength ||
    (imageCount >= 2 && length > O.sparseTextLength)
      ? O.denseFontSize
      : length < O.sparseTextLength && !imageCount
        ? O.sparseFontSize
        : O.regularFontSize;
  const titleLines = wrappedLines(sheet.title, O.titleColumns);
  const verseLines = wrappedLines(sheet.verse, O.verseColumns);
  let fit: OlderMeditationFit | undefined;
  for (const fontSize of O.fontSizes.filter((size) => size <= initialSize)) {
    const prayerLines = wrappedLines(sheet.prayer, O.prayerColumns);
    for (const imageHeight of O.imageHeights.filter(
      (height) =>
        height <=
        (fontSize <= O.denseFontSize
          ? O.denseImageMaximumHeight
          : O.imageHeights[0]),
    )) {
      const activitySpace =
        O.height -
        O.headerReserve -
        O.footerReserve -
        O.tableReserve -
        Math.max(
          wrappedLines(sheet.introduction, O.introductionColumns) *
            fontSize *
            O.lineHeight,
          olderMeditationRichHeight(
            sheet.document,
            'introduction',
            fontSize,
            O.introductionColumns,
          ),
        ) -
        Math.max(
          0,
          olderMeditationRichHeight(
            sheet.document,
            'title',
            24,
            O.titleColumns,
          ) -
            titleLines * 24 * O.lineHeight,
        ) -
        Math.max(
          0,
          olderMeditationRichHeight(
            sheet.document,
            'verseText',
            22,
            O.verseColumns,
          ) -
            verseLines * 22 * O.lineHeight,
        ) -
        Math.max(
          0,
          olderMeditationRichHeight(
            sheet.document,
            'prayer',
            fontSize,
            O.prayerColumns,
          ) -
            prayerLines * fontSize * O.lineHeight,
        ) -
        Math.max(0, titleLines - O.reservedHeaderLines) * 24 * O.lineHeight -
        Math.max(0, verseLines - O.reservedHeaderLines) * 22 * O.lineHeight -
        Math.max(0, prayerLines - O.reservedHeaderLines) *
          fontSize *
          O.lineHeight;
      const weights = sheet.activities
        .slice(0, OLDER_MEDITATION_MAX_ACTIVITIES)
        .map((activity, index) => {
          const columns = Math.floor(
            (width * (activity.image ? O.textColumnShare : 1) * O.wrapSafety) /
              (fontSize * O.twipsPerCharacterUnit),
          );
          const lines = activity.instruction.split(/\r?\n/);
          const isPuzzle = /caça[ -]palavras|cruzadinha/i.test(
            activity.instruction,
          );
          const gridLines = isPuzzle ? lines.filter(isPuzzleGridRow) : [];
          // Grid letters are native cells, never prose words to be wrapped.
          const hasGrid = isPuzzleGridBlock(gridLines);
          const gridRows = hasGrid ? gridLines.length : 0;
          const prose = hasGrid
            ? lines.filter((line) => !isPuzzleGridRow(line)).join('\n')
            : activity.instruction;
          const textHeight =
            wrappedLines(prose, columns) * fontSize * O.lineHeight +
            gridRows *
              Math.min(
                O.gridCellSize,
                fontSize * O.lineHeight + O.gridPadding,
              ) +
            (gridRows ? O.paragraphReserve : 0);
          return (
            Math.max(
              textHeight,
              olderMeditationRichHeight(
                sheet.document,
                `activity${index + 1}`,
                fontSize,
                columns,
              ),
              activity.image ? imageHeight * O.twipsPerPixel : 0,
            ) + O.activityMargins
          );
        });
      fit = {
        fontSize,
        imageHeight,
        weights,
        activitySpace,
        fits: weights.reduce((sum, value) => sum + value, 0) <= activitySpace,
      };
      if (fit.fits) return fit;
    }
  }
  if (!fit)
    throw new UnprocessableEntityException(
      'Não foi possível calcular o encaixe da meditação dos maiores.',
    );
  return fit;
}
