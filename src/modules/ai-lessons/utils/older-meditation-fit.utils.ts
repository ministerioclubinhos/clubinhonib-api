import { OLDER_MEDITATION_LAYOUT as O } from '../constants/older-meditation-layout.constants';
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
    length > 4500
      ? 18
      : length > 3000 || (imageCount >= 2 && length > 2300)
        ? 20
        : length < 2300 && !imageCount
          ? 26
          : 22;
  let fit: OlderMeditationFit | undefined;
  for (const fontSize of O.fontSizes.filter((size) => size <= initialSize)) {
    const imageHeight = fontSize <= 20 ? 180 : 230;
    const activitySpace =
      O.height -
      O.headerReserve -
      O.footerReserve -
      O.tableReserve -
      wrappedLines(sheet.introduction, O.introductionColumns) *
        fontSize *
        O.lineHeight -
      Math.max(0, wrappedLines(sheet.title, O.titleColumns) - 2) *
        24 *
        O.lineHeight -
      Math.max(0, wrappedLines(sheet.verse, O.verseColumns) - 2) *
        22 *
        O.lineHeight -
      Math.max(0, wrappedLines(sheet.prayer, 70) - 2) * fontSize * O.lineHeight;
    const weights = sheet.activities.slice(0, 3).map((activity) => {
      const columns = Math.floor(
        (width * (activity.image ? 0.58 : 1) * O.wrapSafety) / (fontSize * 5),
      );
      const lines = activity.instruction.split(/\r?\n/);
      const isPuzzle = /caça[ -]palavras/i.test(activity.instruction);
      const gridRows = isPuzzle
        ? lines.filter((line) => /^[A-ZÀ-Ü\s]{4,}$/.test(line.trim())).length
        : 0;
      const prose = isPuzzle
        ? lines
            .filter((line) => !/^[A-ZÀ-Ü\s]{4,}$/.test(line.trim()))
            .join('\n')
        : activity.instruction;
      const textHeight =
        wrappedLines(prose, columns) * fontSize * O.lineHeight +
        gridRows *
          Math.min(O.gridCellSize, fontSize * O.lineHeight + O.gridPadding) +
        (gridRows ? O.paragraphReserve : 0);
      return (
        Math.max(textHeight, activity.image ? imageHeight * 15 : 0) +
        O.activityMargins
      );
    });
    fit = { fontSize, imageHeight, weights, activitySpace };
    if (weights.reduce((sum, value) => sum + value, 0) <= activitySpace)
      return fit;
  }
  return fit!;
}
