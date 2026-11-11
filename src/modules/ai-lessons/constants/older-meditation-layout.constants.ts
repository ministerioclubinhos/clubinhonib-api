export const OLDER_MEDITATION_LAYOUT = {
  height: 15400,
  // Includes the nested table terminator paragraphs required by Word/Writer.
  headerReserve: 3700,
  footerReserve: 700,
  tableReserve: 200,
  titleColumns: 43,
  verseColumns: 70,
  introductionColumns: 100,
  lineHeight: 12,
  gridCellSize: 320,
  gridFontSize: 22,
  gridFont: 'Courier New',
  gridPadding: 56,
  fontSizes: [24, 22, 20],
  imageHeights: [230, 210, 190, 180, 170, 160, 150, 140],
  wrapSafety: 0.9,
  activityMargins: 200,
  paragraphReserve: 240,
  /** Share of the free space the activity rows take, so the prayer closes the sheet. */
  activityFillShare: 0.97,
  /** Frame cell side margins and the room its border takes, in twips. */
  frameSideMargin: 160,
  frameBorderAllowance: 60,
  inlineOptionsMaximumCharacters: 60,
  prayerColumns: 70,
  /** Lines of title, verse and prayer already covered by `headerReserve`. */
  reservedHeaderLines: 2,
  denseTextLength: 3000,
  sparseTextLength: 2300,
  denseFontSize: 20,
  regularFontSize: 22,
  sparseFontSize: 26,
  denseImageMaximumHeight: 180,
  /** Share of the row given to the text column when the activity has artwork. */
  textColumnShare: 0.58,
  imageColumnShare: 0.42,
  twipsPerPixel: 15,
  /** Average glyph advance, in twips per half-point of font size. */
  twipsPerCharacterUnit: 5,
} as const;
