import { UnprocessableEntityException } from '@nestjs/common';
import {
  gridRowCells,
  isPuzzleGridBlock,
  isPuzzleGridRow,
} from './meditation-grid.utils';
import { codeLegendPairs } from './meditation-code.utils';
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

const PUZZLE = /caça[ -]palavras|cruzadinha/i;

/** Side of a puzzle grid cell, in twips, at the given font size. */
export function olderMeditationGridCellSide(fontSize: number): number {
  return Math.min(O.gridCellSize, fontSize * O.lineHeight + O.gridPadding);
}

/**
 * Columns of the puzzle grid printed beside the text, as in the handmade
 * sheets (text on the left, word search on the right), or 0 when the grid
 * stays below the text: the question has artwork or the grid is too wide.
 */
export function olderMeditationSideGridColumns(
  instruction: string,
  hasImage: boolean,
  fontSize: number,
): number {
  if (hasImage || !PUZZLE.test(instruction)) return 0;
  const rows = instruction.split(/\r?\n/).filter(isPuzzleGridRow);
  if (!isPuzzleGridBlock(rows)) return 0;
  const columns = gridRowCells(rows[0]).length;
  const width = L.width - 2 * O.frameSideMargin - O.frameBorderAllowance;
  return rows.every((row) => gridRowCells(row).length === columns) &&
    columns * olderMeditationGridCellSide(fontSize) <=
      width * O.imageColumnShare - O.sideGridGutter
    ? columns
    : 0;
}

export function fitOlderMeditationSheet(
  sheet: OlderMeditationSheet,
): OlderMeditationFit {
  const width = L.width - 2 * O.frameSideMargin - O.frameBorderAllowance;
  const length =
    sheet.introduction.length +
    sheet.activities.reduce((sum, item) => sum + item.instruction.length, 0);
  const imageCount = sheet.activities.filter(
    (activity) => activity.image,
  ).length;
  // The printed sheets fill the page: start from the largest font and
  // shrink only while the content does not fit.
  const initialSize =
    length > O.denseTextLength ||
    (imageCount >= 2 && length > O.sparseTextLength)
      ? O.regularFontSize
      : O.fontSizes[0];
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
        // The reserves were measured at the smallest font.
        (fontSize - O.fontSizes[O.fontSizes.length - 1]) *
          O.lineHeight *
          O.bodyFontHeaderLines -
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
          const sideGrid = olderMeditationSideGridColumns(
            activity.instruction,
            Boolean(activity.image),
            fontSize,
          );
          const columns = Math.floor(
            (width *
              (activity.image || sideGrid ? O.textColumnShare : 1) *
              O.wrapSafety) /
              (fontSize * O.twipsPerCharacterUnit),
          );
          const lines = activity.instruction.split(/\r?\n/);
          const isPuzzle = PUZZLE.test(activity.instruction);
          const gridLines = isPuzzle ? lines.filter(isPuzzleGridRow) : [];
          // Grid letters are native cells, never prose words to be wrapped.
          const hasGrid = isPuzzleGridBlock(gridLines);
          const gridRows = hasGrid ? gridLines.length : 0;
          // Code legends print as boxed rows (symbol above, meaning below).
          const legendRows = lines.reduce((sum, line) => {
            const pairs = codeLegendPairs(line);
            return (
              sum +
              (pairs ? Math.ceil(pairs.length / O.codeLegendColumns) * 2 : 0)
            );
          }, 0);
          const prose = lines
            .filter(
              (line) =>
                !(hasGrid && isPuzzleGridRow(line)) && !codeLegendPairs(line),
            )
            .join('\n');
          const proseHeight =
            wrappedLines(prose, columns) * fontSize * O.lineHeight +
            legendRows * (fontSize * O.lineHeight + O.gridPadding);
          const gridHeight =
            gridRows * olderMeditationGridCellSide(fontSize) +
            (gridRows ? O.paragraphReserve : 0);
          const richHeight = olderMeditationRichHeight(
            sheet.document,
            `activity${index + 1}`,
            fontSize,
            columns,
          );
          // The rich document counts every grid row as a text line.
          const richProse = Math.max(
            0,
            richHeight - gridRows * fontSize * O.lineHeight,
          );
          return (
            (sideGrid
              ? Math.max(proseHeight, richProse, gridHeight)
              : Math.max(
                  proseHeight + gridHeight,
                  richHeight,
                  activity.image ? imageHeight * O.twipsPerPixel : 0,
                )) + O.activityMargins
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
