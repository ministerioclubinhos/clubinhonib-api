import {
  MEDITATION_GRID_MINIMUM_ROWS,
  MEDITATION_GRID_MINIMUM_SPACED_CELLS,
  MEDITATION_GRID_MINIMUM_WIDTH,
} from '../constants/meditation-word-search.constants';

const LETTER_CELL = /^\p{Lu}$/u;
const LETTER_ROW = /^\p{Lu}+$/u;
const PUZZLE_CELL = /^[\p{Lu}\d#._]$/u;
const PUZZLE_ROW = /^[\p{Lu}\d#._]+$/u;
const ANSWER_BLANKS = /^[_\s]+$/;
const MEANINGFUL_CELL = /[\p{Lu}\d#]/u;

function isGridRow(line: string, cell: RegExp, row: RegExp): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/);
  // Either one unbroken run of cells or cells separated one by one. An
  // uppercase sentence ("ENCONTRE AS PALAVRAS") has multi-letter tokens and is
  // prose, not a grid row.
  return tokens.length === 1
    ? trimmed.length >= MEDITATION_GRID_MINIMUM_WIDTH && row.test(trimmed)
    : tokens.length >= MEDITATION_GRID_MINIMUM_SPACED_CELLS &&
        tokens.every((token) => cell.test(token));
}

/** A row of a letters-only word-search grid. */
export function isWordSearchGridRow(line: string): boolean {
  return isGridRow(line, LETTER_CELL, LETTER_ROW);
}

/** A row of a word search or crossword (`#` blocked, `.` empty, digits = clue starts). */
export function isPuzzleGridRow(line: string): boolean {
  return !ANSWER_BLANKS.test(line) && isGridRow(line, PUZZLE_CELL, PUZZLE_ROW);
}

/** Consecutive rows form a grid only when at least one carries real content. */
export function isPuzzleGridBlock(rows: readonly string[]): boolean {
  return (
    rows.length >= MEDITATION_GRID_MINIMUM_ROWS &&
    rows.some((row) => MEANINGFUL_CELL.test(row))
  );
}

/** Grid letters without accents or spacing, as compared and printed. */
export function gridRowCells(line: string): string {
  return line.normalize('NFD').replace(/[̀-ͯ\s]/g, '').toUpperCase();
}
