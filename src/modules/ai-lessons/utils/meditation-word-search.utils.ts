import {
  MEDITATION_GRID_MINIMUM_ROWS,
  MEDITATION_WORD_SEARCH_DIRECTIONS,
} from '../constants/meditation-word-search.constants';
import {
  gridRowCells as letters,
  isWordSearchGridRow,
} from './meditation-grid.utils';

export function meditationWordSearchIssue(instruction: string): string | null {
  if (!/caça[ -]palavras/i.test(instruction)) return null;
  const lines = instruction.split(/\r?\n/);
  const grid: string[] = [];
  for (const line of lines) {
    if (isWordSearchGridRow(line)) grid.push(letters(line));
    else if (grid.length >= MEDITATION_GRID_MINIMUM_ROWS) break;
    else grid.length = 0;
  }
  // Visual puzzles may supply their grid in the associated image instead.
  if (grid.length < MEDITATION_GRID_MINIMUM_ROWS) return null;
  if (grid.some((row) => row.length !== grid[0].length))
    return 'O caça-palavras tem linhas com tamanhos diferentes; refaça uma grade retangular.';
  const list = instruction.match(/^\s*palavras\s*:\s*([^\n]+)/im)?.[1];
  if (!list)
    return 'O caça-palavras textual não apresenta a lista de palavras.';
  const words = list
    .split(/[,;]|\s+e\s+/i)
    .map((word) => letters(word.replace(/[.!?]+$/, '')));
  for (const word of words) {
    const found = grid.some((row, y) =>
      Array.from(row).some((_, x) =>
        MEDITATION_WORD_SEARCH_DIRECTIONS.some(([dy, dx]) =>
          Array.from(word).every(
            (letter, index) =>
              grid[y + dy * index]?.[x + dx * index] === letter,
          ),
        ),
      ),
    );
    if (!found)
      return `O caça-palavras não contém a palavra completa ${word}; refaça a grade e confira todas as posições.`;
  }
  return null;
}
