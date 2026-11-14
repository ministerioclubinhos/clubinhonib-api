export const OLDER_MEDITATION_LAYOUT = {
  height: 15400,
  // Includes the nested table terminator paragraphs required by Word/Writer.
  headerReserve: 3300,
  footerReserve: 700,
  tableReserve: 200,
  titleColumns: 43,
  verseColumns: 70,
  introductionColumns: 100,
  lineHeight: 12,
  gridCellSize: 320,
  gridFontSize: 22,
  /** Clue numbers inside crossword cells, in half-points. */
  gridClueFontSize: 14,
  gridFont: 'Courier New',
  gridPadding: 56,
  fontSizes: [26, 24, 22, 20],
  imageHeights: [270, 250, 230, 210, 190, 180, 170, 160, 150, 140],
  /** Measured on rendered PDFs: Arial fits about 2% fewer characters than the average advance predicts. */
  wrapSafety: 0.98,
  activityMargins: 200,
  paragraphReserve: 240,
  /** Share of the free space the activity rows take, so the prayer closes the sheet. */
  activityFillShare: 0.97,
  /** Frame cell side margins and the room its border takes, in twips. */
  frameSideMargin: 160,
  frameBorderAllowance: 60,
  inlineOptionsMaximumCharacters: 60,
  /** Code legends print as boxes: symbol above, meaning below. */
  codeLegendMinimumPairs: 4,
  codeLegendColumns: 13,
  codeLegendCellWidth: 560,
  codeLegendFont: 'Arial',
  /** A line to write an open answer on. */
  writingLine: '_'.repeat(70),
  prayerColumns: 70,
  /** Lines of title, verse and prayer already covered by `headerReserve`. */
  reservedHeaderLines: 2,
  /** Lines outside the questions that grow with the body font: the section heading and the prayer. */
  bodyFontHeaderLines: 3,
  denseTextLength: 3000,
  sparseTextLength: 2300,
  denseFontSize: 20,
  regularFontSize: 22,
  sparseFontSize: 26,
  denseImageMaximumHeight: 180,
  /** Share of the row given to the text column when the activity has artwork. */
  textColumnShare: 0.58,
  imageColumnShare: 0.42,
  /** Room between the text column and a grid or artwork beside it, in twips. */
  sideGridGutter: 300,
  twipsPerPixel: 15,
  /** Average glyph advance, in twips per half-point of font size. */
  twipsPerCharacterUnit: 5,
} as const;

/** A subtitle that is only Bible references ("Lucas 16.19-31; João 11"). */
export const OLDER_MEDITATION_REFERENCE_ONLY =
  /^(?:[1-3]?\s?\p{L}{2,}\.?\s+\d+(?:[.:]\d+)?(?:\s*[-–]\s*\d+)?[a-z]?(?:\s*[;,]\s*)?)+[\s.]*$/u;
