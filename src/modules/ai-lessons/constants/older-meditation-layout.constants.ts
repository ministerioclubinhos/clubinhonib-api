export const OLDER_MEDITATION_LAYOUT = {
  height: 15400,
  // Includes the nested table terminator paragraphs required by Word/Writer.
  headerReserve: 4000,
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
  fontSizes: [26, 24, 22, 20, 18],
  wrapSafety: 0.9,
  activityMargins: 200,
  paragraphReserve: 240,
} as const;
