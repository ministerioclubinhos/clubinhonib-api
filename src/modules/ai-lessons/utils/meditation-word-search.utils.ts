import { MEDITATION_WORD_SEARCH_DIRECTIONS } from '../constants/meditation-word-search.constants';

function letters(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f\s]/g, '')
    .toUpperCase();
}

export function meditationWordSearchIssue(instruction: string): string | null {
  if (!/caça[ -]palavras/i.test(instruction)) return null;
  const lines = instruction.split(/\r?\n/);
  const grid: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[A-ZÀ-Ü\s]{4,}$/.test(trimmed)) grid.push(letters(trimmed));
    else if (grid.length >= 3) break;
    else grid.length = 0;
  }
  // Visual puzzles may supply their grid in the associated image instead.
  if (grid.length < 3) return null;
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
