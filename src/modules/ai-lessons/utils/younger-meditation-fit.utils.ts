import type {
  YoungerMeditationSheet,
  YoungerMeditationFit,
} from '../types/younger-meditation.types';

/** Reserve room for the complete texts before sizing the two coloring drawings. */
export function youngerMeditationFit(
  sheet: YoungerMeditationSheet,
): YoungerMeditationFit {
  const length = Math.max(
    ...sheet.activities.map((activity) => activity.instruction.length),
    0,
  );
  const textSize =
    length > 850 ? 14 : length > 600 ? 16 : length > 400 ? 18 : 20;
  const charactersPerLine = 250 / ((textSize / 2) * 0.52);
  const estimatedLines = Math.max(
    ...sheet.activities.map((activity) =>
      activity.instruction
        .split(/\r?\n/)
        .reduce(
          (sum, line) =>
            sum + Math.max(1, Math.ceil(line.length / charactersPerLine)),
          0,
        ),
    ),
    0,
  );
  const imageHeight = Math.max(
    60,
    Math.min(160, 245 - estimatedLines * (textSize / 2 + 1)),
  );
  return {
    textSize,
    imageHeight,
    titleSize: sheet.title.length > 110 ? 18 : 23,
    verseSize: sheet.verse.length > 250 ? 16 : 20,
  };
}
