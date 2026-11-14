export const MANUAL_WORK_LAYOUT = {
  pageWidth: 11906,
  pageHeight: 16838,
  margin: 360,
  width: 11186,
  /** Height of each of the two copies: together they fill the A4 page. */
  halfHeight: 7500,
  /** Logo and "TRABALHO MANUAL" band, side by side. */
  headerReserve: 620,
  /** Frame padding, borders and paragraph spacing around the artwork. */
  copyReserve: 520,
  /** Verse in bold capitals, as in the handmade sheets (half-points). */
  verseSize: 22,
  verseColumns: 68,
  verseLineHeight: 270,
  /** Width/height of the stored artwork: wide, to span the whole frame. */
  artAspectRatio: 1.8,
  /** The artwork spans the whole frame. */
  imageMaximumWidth: 722,
  imageMaximumHeight: 440,
  imageMinimumHeight: 160,
  twipsPerPixel: 15,
  /** How far from pure white a pixel may be and still count as paper. */
  trimThreshold: 30,
  /** Largest share of the artwork height cut so it spans the frame width. */
  maximumCropShare: 0.24,
  /** Share of the cut taken from the top: heads sit there, the ground can go. */
  cropTopShare: 0.2,
  frameBorderSize: 24,
  logoWidth: 90,
  logoHeight: 36,
  logoColumnWidth: 2000,
  bandWidth: 3400,
  bandFill: '000000',
  bandColor: 'FFFFFF',
  bandSize: 22,
  font: 'Arial',
  framePadding: 80,
} as const;
