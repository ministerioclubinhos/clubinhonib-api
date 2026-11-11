import { YOUNGER_MEDITATION_LAYOUT as L } from '../constants/younger-meditation-layout.constants';
import type {
  YoungerMeditationSheet,
  YoungerMeditationFit,
} from '../types/younger-meditation.types';
import { olderMeditationRichHeight } from './older-meditation-measure.utils';

function columnsFor(widthTwips: number, size: number): number {
  return Math.max(
    1,
    Math.floor(
      widthTwips / L.twipsPerPoint / ((size / 2) * L.averageCharacterWidth),
    ),
  );
}

function plainHeight(value: string, size: number, columns: number): number {
  return (
    value
      .split(/\r?\n/)
      .reduce(
        (sum, line) => sum + Math.max(1, Math.ceil(line.length / columns)),
        0,
      ) *
    size *
    L.lineHeight
  );
}

/**
 * Height of a field: the saved rich document (which may carry larger fonts,
 * lists and tables) when it exists, never less than the plain-text estimate.
 */
function fieldHeight(
  sheet: YoungerMeditationSheet,
  field: string,
  fallback: string,
  size: number,
  widthTwips: number,
): number {
  const columns = columnsFor(widthTwips, size);
  return Math.max(
    plainHeight(fallback, size, columns),
    olderMeditationRichHeight(sheet.document, field, size, columns),
  );
}

/**
 * Reserves room for the complete texts before sizing the two drawings, and
 * reports when even the smallest legible size overflows the half sheet: the
 * copy has a fixed height, so overflowing content would be cut in the PDF.
 */
export function youngerMeditationFit(
  sheet: YoungerMeditationSheet,
): YoungerMeditationFit {
  const innerWidth = L.width - 180;
  const activityWidth =
    Math.floor(innerWidth / 2) - L.activityHorizontalPadding;
  const longest = Math.max(
    ...sheet.activities.map((activity) => activity.instruction.length),
    0,
  );
  const initialSize =
    longest > 850 ? 14 : longest > 600 ? 16 : longest > 400 ? 18 : 20;
  const titleSize = sheet.title.length > 110 ? 18 : L.titleSize;
  const verseSize = sheet.verse.length > 250 ? 16 : L.textSize;
  const headerHeight = Math.max(
    L.logoRowHeight,
    L.bannerHeight +
      fieldHeight(sheet, 'title', sheet.title, titleSize, L.titleColumnWidth) +
      L.cellPadding +
      L.tableTerminator,
  );
  const verseHeight = Math.max(
    L.verseRowMinimum,
    Math.max(
      plainHeight(
        sheet.verse,
        verseSize,
        columnsFor(innerWidth - L.verseColumnOffset, verseSize),
      ),
      olderMeditationRichHeight(
        sheet.document,
        'verseText',
        verseSize,
        columnsFor(innerWidth - L.verseColumnOffset, verseSize),
      ) +
        olderMeditationRichHeight(
          sheet.document,
          'verseReference',
          verseSize,
          columnsFor(innerWidth - L.verseColumnOffset, verseSize),
        ),
    ) + L.versePadding,
  );
  const hasImage = sheet.activities.some((activity) => activity.image);

  let fit: YoungerMeditationFit = {
    textSize: initialSize,
    imageHeight: L.imageMinimumHeight,
    titleSize,
    verseSize,
    activityRowHeight: L.activityRowMinimum,
    fits: false,
  };
  for (const textSize of L.textSizes.filter((size) => size <= initialSize)) {
    const prayerHeight = Math.max(
      L.prayerRowMinimum,
      fieldHeight(
        sheet,
        'prayer',
        sheet.prayer,
        textSize,
        innerWidth - L.prayerColumnOffset,
      ) + L.cellPadding,
    );
    const activitySpace =
      L.halfHeight -
      L.frameMargins -
      headerHeight -
      L.nameRowHeight -
      verseHeight -
      prayerHeight -
      L.tableTerminator;
    const textHeight = Math.max(
      ...sheet.activities.map((activity, index) =>
        fieldHeight(
          sheet,
          `activity${index + 1}`,
          activity.instruction,
          textSize,
          activityWidth,
        ),
      ),
      0,
    );
    const imageHeight = Math.max(
      L.imageMinimumHeight,
      Math.min(
        L.imageMaximumHeight,
        Math.floor(
          (activitySpace - L.activityPadding - textHeight) / L.twipsPerPixel,
        ),
      ),
    );
    const minimumNeeded =
      textHeight +
      L.activityPadding +
      (hasImage ? L.imageMinimumHeight * L.twipsPerPixel : 0);
    fit = {
      textSize,
      imageHeight,
      titleSize,
      verseSize,
      activityRowHeight: Math.max(
        L.activityRowMinimum,
        Math.min(L.activityRowHeight, activitySpace),
      ),
      fits:
        activitySpace * L.overflowTolerance >=
        Math.max(L.activityRowMinimum, minimumNeeded),
    };
    if (fit.fits) return fit;
  }
  return fit;
}
