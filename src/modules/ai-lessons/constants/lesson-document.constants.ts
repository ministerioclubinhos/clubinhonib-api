export const DOCX_HALF_POINTS_PER_POINT = 2;
export const CSS_PIXELS_PER_POINT = 4 / 3;
export const DOCX_LINE_UNITS_PER_LINE = 240;
export const DOCUMENT_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
export const DOCUMENT_MAX_FONT_SIZE_PT = 96;
export const DOCUMENT_MAX_LINE_HEIGHT = 4;
export const DOCUMENT_MAX_TABLE_SPAN = 100;
/** Default body run size, in half-points (12 pt). */
export const DOCUMENT_DEFAULT_FONT_SIZE = 24;
export const DOCUMENT_DEFAULT_COLOR = '000000';
export const DOCUMENT_LINK_COLOR = '0563C1';
export const DOCUMENT_DEFAULT_HIGHLIGHT = 'FFFF00';
export const DOCUMENT_CODE_FONT = 'Courier New';
export const DOCUMENT_BASE_FONT = 'Calibri';
/** Twips of indentation added per list nesting level. */
export const DOCUMENT_LIST_INDENT = 360;

/** Code points XML 1.0 forbids; a single one makes LibreOffice reject the file. */
export const XML_ALLOWED_CONTROL_CODES: ReadonlySet<number> = new Set([
  0x09, 0x0a, 0x0d,
]);
export const XML_FIRST_PRINTABLE_CODE = 0x20;
export const XML_NONCHARACTER_CODES: ReadonlySet<number> = new Set([
  0xfffe, 0xffff,
]);

/** CSS colour keywords the editor or pasted content may carry. */
export const CSS_NAMED_COLORS: Readonly<Record<string, string>> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  orange: 'FFA500',
  purple: '800080',
  pink: 'FFC0CB',
  brown: 'A52A2A',
  gray: '808080',
  grey: '808080',
  silver: 'C0C0C0',
  navy: '000080',
  teal: '008080',
  maroon: '800000',
  olive: '808000',
  lime: '00FF00',
  aqua: '00FFFF',
  cyan: '00FFFF',
  fuchsia: 'FF00FF',
  magenta: 'FF00FF',
};

/** Labels left in English by early generations, shown translated in the PDF. */
export const LEGACY_DOCUMENT_LABELS: Readonly<Record<string, string>> = {
  'FUN MECHANICS': 'MECÂNICAS DIVERTIDAS',
  AGES5TO7: 'CRIANÇAS DE 5 A 7 ANOS',
  AGES8TO11: 'CRIANÇAS DE 8 A 11 ANOS',
};

/** Pixel boxes (96 dpi) of the artwork pages built by the exporter. */
export const DOCUMENT_IMAGE_BOXES = {
  headerLeft: { width: 190, height: 95 },
  headerRight: { width: 190, height: 95 },
  landscapeFull: { width: 1070, height: 758 },
  landscapeWithText: { width: 984, height: 620 },
  portraitFull: { width: 760, height: 1074 },
} as const;

/** Aspect ratio assumed only when an image header cannot be parsed. */
export const DOCUMENT_FALLBACK_IMAGE_RATIO = 1.5;

export const YOUNGER_MEDITATION_MAX_ACTIVITIES = 2;
export const OLDER_MEDITATION_MAX_ACTIVITIES = 3;

/** `**texto**` written by the model; becomes a bold mark instead of literal asterisks. */
export const MARKDOWN_BOLD_PATTERN = /\*\*(.+?)\*\*/g;
/** Stray emphasis markers left after the bold spans are converted. */
export const MARKDOWN_STRAY_BOLD_MARKER = /\*\*/g;
