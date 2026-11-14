import {
  MEDITATION_WORD_SEARCH_GENERATED_DIRECTIONS as DIRECTIONS,
  MEDITATION_WORD_SEARCH_MIN_HEIGHT,
  MEDITATION_WORD_SEARCH_MIN_WIDTH,
  MEDITATION_WORD_SEARCH_PLACEMENT_TRIES,
  MEDITATION_WORD_SEARCH_WEIGHTED_FILLER as FILLER,
} from '../constants/meditation-word-search.constants';

/** Small seeded generator: the same word list always builds the same grid. */
function seededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (const char of seedText)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A word-search grid like the printed sheets: random filler letters and the
 * words hidden horizontally, vertically and diagonally. Returns the rows
 * (letters separated by spaces) and the answer key, or null when the words
 * do not fit even in an enlarged grid.
 */
export function buildMeditationWordSearchGrid(
  words: readonly string[],
): { rows: string[]; positions: string[] } | null {
  const random = seededRandom(words.join('|'));
  const longest = Math.max(...words.map((word) => word.length));
  for (let grow = 0; grow < 4; grow++) {
    const width =
      Math.max(MEDITATION_WORD_SEARCH_MIN_WIDTH, longest + 2) + grow;
    const height =
      Math.max(MEDITATION_WORD_SEARCH_MIN_HEIGHT, words.length + 3) + grow;
    const grid: Array<Array<string | null>> = Array.from(
      { length: height },
      () => Array.from({ length: width }, () => null),
    );
    const positions: string[] = [];
    // Longest words first: they are the hardest to place.
    const ordered = [...words].sort((a, b) => b.length - a.length);
    const placedAll = ordered.every((word, index) => {
      for (
        let attempt = 0;
        attempt < MEDITATION_WORD_SEARCH_PLACEMENT_TRIES;
        attempt++
      ) {
        // Spread the directions across the words, then try the others.
        const direction =
          DIRECTIONS[(index + Math.floor(attempt / 50)) % DIRECTIONS.length];
        const maxRow = height - (direction.dy ? word.length : 1);
        const maxColumn = width - (direction.dx ? word.length : 1);
        if (maxRow < 0 || maxColumn < 0) continue;
        const row = Math.floor(random() * (maxRow + 1));
        const column = Math.floor(random() * (maxColumn + 1));
        const fits = Array.from(word).every((letter, offset) => {
          const cell =
            grid[row + direction.dy * offset][column + direction.dx * offset];
          return cell === null || cell === letter;
        });
        if (!fits) continue;
        Array.from(word).forEach((letter, offset) => {
          grid[row + direction.dy * offset][column + direction.dx * offset] =
            letter;
        });
        positions.push(
          `${word}: linha ${row + 1}, coluna ${column + 1}, ${direction.label}.`,
        );
        return true;
      }
      return false;
    });
    if (!placedAll) continue;
    const rows = grid.map((line) =>
      line
        .map((cell) => cell ?? FILLER[Math.floor(random() * FILLER.length)])
        .join(' '),
    );
    // Keep the key in the order the words are listed on the sheet.
    const key = words.map(
      (word) => positions.find((line) => line.startsWith(`${word}:`)) ?? '',
    );
    return { rows, positions: key };
  }
  return null;
}
