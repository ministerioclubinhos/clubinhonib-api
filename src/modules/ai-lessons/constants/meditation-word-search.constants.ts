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
