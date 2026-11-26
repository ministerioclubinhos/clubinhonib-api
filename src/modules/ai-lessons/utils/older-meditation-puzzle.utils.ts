import {
  OLDER_MEDITATION_CROSSWORD as C,
  OLDER_MEDITATION_PUZZLE_KEYWORD,
} from '../constants/older-meditation-puzzle.constants';
import {
  MEDITATION_WORD_SEARCH_MAX_WORD_LENGTH,
  MEDITATION_WORD_SEARCH_MAX_WORDS,
} from '../constants/meditation-word-search.constants';
import { OlderMeditationMechanic as Mechanic } from '../enums/older-meditation.enums';
import type {
  OlderMeditationCrossword,
  OlderMeditationCrosswordPlacement as Placement,
  OlderMeditationPuzzle,
} from '../types/older-meditation.types';
import type { MeditationJson } from '../types/younger-meditation.types';
import { isPuzzleGridRow } from './meditation-grid.utils';
import { buildMeditationWordSearchGrid } from './meditation-word-search-grid.utils';

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** A word as it is hidden in a grid: capitals, no accents, spaces or hyphens. */
export function puzzleWord(value: string): string {
  return value
    .replace(/[.!?:]+$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function wordList(value: string): string[] {
  const words = value
    .split(/[,;/|\n]|\s+e\s+/i)
    .map(puzzleWord)
    .filter(
      (word) =>
        /^[A-Z]{2,}$/.test(word) &&
        word.length <= MEDITATION_WORD_SEARCH_MAX_WORD_LENGTH,
    );
  return [...new Set(words)].slice(0, MEDITATION_WORD_SEARCH_MAX_WORDS);
}

/**
 * The words of a word search: the "Palavras:" line, or else the answer keys
 * (the model sometimes lists one word per subitem and no list).
 */
export function olderMeditationWordSearchWords(
  supportText: string,
  answers: readonly string[],
): string[] {
  const listed = supportText.match(/^\s*palavras[^:\n]*:\s*([^\n]+)/im)?.[1];
  const fromList = listed ? wordList(listed) : [];
  if (fromList.length >= 2) return fromList;
  const plain = answers
    .map((answer) => answer.split(':')[0])
    .filter((answer) => !/linha|coluna/i.test(answer));
  return wordList(plain.join(','));
}

/**
 * The server always draws the word-search grid, as in the printed sheets:
 * the model only chooses the words. Returns null when no usable list exists.
 */
export function buildOlderMeditationWordSearch(
  supportText: string,
  answers: readonly string[],
): OlderMeditationPuzzle | null {
  const words = olderMeditationWordSearchWords(supportText, answers);
  if (words.length < 2) return null;
  const built = buildMeditationWordSearchGrid(words);
  if (!built) return null;
  return {
    supportText: [`Palavras: ${words.join(', ')}`, ...built.rows].join('\n'),
    answer: built.positions.join('\n'),
  };
}

type Cells = Map<string, string>;
const key = (row: number, column: number): string => `${row}:${column}`;

function placementFits(cells: Cells, starts: Set<string>, p: Placement) {
  const dy = p.across ? 0 : 1;
  const dx = p.across ? 1 : 0;
  if (starts.has(key(p.row, p.column))) return -1;
  // The word needs an empty cell before and after it.
  if (
    cells.has(key(p.row - dy, p.column - dx)) ||
    cells.has(key(p.row + dy * p.word.length, p.column + dx * p.word.length))
  )
    return -1;
  let crossings = 0;
  for (let offset = 0; offset < p.word.length; offset++) {
    const row = p.row + dy * offset;
    const column = p.column + dx * offset;
    const existing = cells.get(key(row, column));
    if (existing === p.word[offset]) {
      crossings++;
      continue;
    }
    // A free cell cannot touch a parallel word, or it would spell nonsense.
    if (
      existing ||
      cells.has(key(row - dx, column - dy)) ||
      cells.has(key(row + dx, column + dy))
    )
      return -1;
  }
  // Fully overlapping an existing run is not a new word.
  return crossings === p.word.length ? -1 : crossings;
}

function place(cells: Cells, starts: Set<string>, p: Placement): void {
  starts.add(key(p.row, p.column));
  Array.from(p.word).forEach((letter, offset) =>
    cells.set(
      key(p.row + (p.across ? 0 : offset), p.column + (p.across ? offset : 0)),
      letter,
    ),
  );
}

/**
 * Lays the answers out as a crossword and prints the grid in the sheet's
 * textual format: "#" blocked, "." empty and the clue number in the first
 * cell of each word. Words that share no letter are set apart, so every
 * list of answers gives a solvable grid. Returns null for unusable answers.
 */
export function buildOlderMeditationCrossword(
  answers: readonly string[],
): OlderMeditationCrossword | null {
  const words = answers.map(puzzleWord);
  if (
    words.length < C.minimumWords ||
    words.length > C.maximumWords ||
    new Set(words).size !== words.length ||
    words.some(
      (word) =>
        !/^[A-Z]+$/.test(word) ||
        word.length < C.minimumLetters ||
        word.length > C.maximumLetters,
    )
  )
    return null;
  const cells: Cells = new Map();
  const starts = new Set<string>();
  const placed: Placement[] = [];
  const pending = words
    .map((word, index) => ({ word, number: index + 1 }))
    .sort((a, b) => b.word.length - a.word.length);
  const put = (p: Placement): void => {
    place(cells, starts, p);
    placed.push(p);
  };
  put({ ...pending.shift()!, row: 0, column: 0, across: true });
  // Retry the words that found no crossing once others are on the grid.
  for (let round = 0; round < words.length && pending.length; round++) {
    for (const item of [...pending]) {
      let best: Placement | undefined;
      let bestScore = 0;
      for (const anchor of placed) {
        for (let i = 0; i < anchor.word.length; i++) {
          for (let j = 0; j < item.word.length; j++) {
            if (anchor.word[i] !== item.word[j]) continue;
            const candidate: Placement = {
              ...item,
              across: !anchor.across,
              row: anchor.row + (anchor.across ? -j : i),
              column: anchor.column + (anchor.across ? i : -j),
            };
            const score = placementFits(cells, starts, candidate);
            if (score > bestScore) {
              best = candidate;
              bestScore = score;
            }
          }
        }
      }
      if (!best) continue;
      put(best);
      pending.splice(pending.indexOf(item), 1);
    }
  }
  // No shared letter: the word goes below the grid, on its own row.
  for (const item of pending) {
    const rows = [...cells.keys()].map((cell) => Number(cell.split(':')[0]));
    const columns = [...cells.keys()].map((cell) => Number(cell.split(':')[1]));
    put({
      ...item,
      across: true,
      row: Math.max(...rows) + 2,
      column: Math.min(...columns),
    });
  }
  const rows = [...cells.keys()].map((cell) => Number(cell.split(':')[0]));
  const columns = [...cells.keys()].map((cell) => Number(cell.split(':')[1]));
  const top = Math.min(...rows);
  const left = Math.min(...columns);
  const width = Math.max(Math.max(...columns) - left + 1, C.minimumSide);
  const height = Math.max(Math.max(...rows) - top + 1, C.minimumSide);
  if (width > C.maximumSide || height > C.maximumSide) return null;
  const numbers = new Map(
    placed.map((p) => [key(p.row, p.column), String(p.number)]),
  );
  const grid = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, column) => {
      const cell = key(row + top, column + left);
      return numbers.get(cell) ?? (cells.has(cell) ? '.' : '#');
    }).join(' '),
  );
  const ordered = [...placed].sort((a, b) => a.number - b.number);
  return {
    supportText: grid.join('\n'),
    answer: ordered
      .map(
        (p) =>
          `${p.number}) ${p.word} (${p.across ? 'horizontal' : 'vertical'})`,
      )
      .join('\n'),
    directions: ordered.map((p) => (p.across ? 'horizontal' : 'vertical')),
  };
}

/** True when the support text already carries a drawn puzzle grid. */
export function hasPuzzleGrid(supportText: string): boolean {
  return (
    supportText.split(/\r?\n/).filter((line) => isPuzzleGridRow(line)).length >=
    C.minimumSide
  );
}

/**
 * The printed grid is recognised by the name of the puzzle in the text: make
 * sure the command carries it, whatever wording the model chose.
 */
export function olderMeditationPuzzleCommand(
  mechanic: unknown,
  command: string,
  context: string,
): string {
  const keyword = OLDER_MEDITATION_PUZZLE_KEYWORD[mechanic as Mechanic];
  if (!keyword || keyword.pattern.test(`${context} ${command}`)) return command;
  return [command, keyword.sentence].filter(Boolean).join(' ');
}

/** Crossword clues are the subitems: one clue and a one-word answer each. */
export function olderMeditationCrosswordAnswers(
  items: readonly MeditationJson[],
): string[] | null {
  // "Muito amor" is two words: it cannot be one row of the grid.
  const answers = items.map((item) =>
    /\s/.test(text(item.answer)) ? '' : puzzleWord(text(item.answer)),
  );
  return items.length >= C.minimumWords &&
    answers.every((answer) => /^[A-Z]+$/.test(answer))
    ? answers
    : null;
}
