export const MEDITATION_WORD_SEARCH_DIRECTIONS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

export const MEDITATION_WORD_SEARCH_MAX_WORDS = 8;
export const MEDITATION_WORD_SEARCH_MAX_WORD_LENGTH = 24;
export const MEDITATION_WORD_SEARCH_GRID_PADDING = 2;
export const MEDITATION_WORD_SEARCH_FILLER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const MEDITATION_GRID_MINIMUM_ROWS = 3;
/** Shortest unbroken row ("ABCD") treated as grid cells. */
export const MEDITATION_GRID_MINIMUM_WIDTH = 4;
/** Fewest one-letter tokens ("A B C") treated as grid cells. */
export const MEDITATION_GRID_MINIMUM_SPACED_CELLS = 3;

/** Directions a generated grid hides words in: right, down and diagonal. */
export const MEDITATION_WORD_SEARCH_GENERATED_DIRECTIONS = [
  { dy: 0, dx: 1, label: 'na horizontal' },
  { dy: 1, dx: 0, label: 'na vertical' },
  { dy: 1, dx: 1, label: 'na diagonal' },
] as const;
/** Filler letters weighted by how often they appear in Portuguese. */
export const MEDITATION_WORD_SEARCH_WEIGHTED_FILLER =
  'AAAAEEEEOOOIIIUURRRSSSNNMMTTDDLLCCPPVBGFHQJZ';
export const MEDITATION_WORD_SEARCH_MIN_WIDTH = 10;
export const MEDITATION_WORD_SEARCH_MIN_HEIGHT = 8;
export const MEDITATION_WORD_SEARCH_PLACEMENT_TRIES = 200;
