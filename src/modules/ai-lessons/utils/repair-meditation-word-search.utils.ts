import {
  MEDITATION_WORD_SEARCH_FILLER,
  MEDITATION_WORD_SEARCH_GRID_PADDING,
  MEDITATION_WORD_SEARCH_MAX_WORD_LENGTH,
  MEDITATION_WORD_SEARCH_MAX_WORDS,
} from '../constants/meditation-word-search.constants';
import type { MeditationJson } from '../types/younger-meditation.types';
import { meditationWordSearchIssue } from './meditation-word-search.utils';

/** Rebuild only recognizable broken text puzzles; ambiguous output still needs correction. */
export function repairMeditationWordSearch(
  content: MeditationJson,
): MeditationJson {
  if (!Array.isArray(content.activities)) return content;
  const repairedIds = new Set<string>();
  const activities = content.activities.map((value: unknown, index: number) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return value;
    const activity = value as MeditationJson;
    const instruction = activity.instruction;
    if (
      typeof instruction !== 'string' ||
      !meditationWordSearchIssue(instruction)
    )
      return activity;
    const list = instruction.match(/^\s*palavras\s*:\s*([^\n]+)/im)?.[1];
    if (!list) return activity;
    const words = list.split(/[,;]|\s+e\s+/i).map((word) =>
      word
        .trim()
        .replace(/[.!?]+$/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase(),
    );
    if (
      words.length < 2 ||
      words.length > MEDITATION_WORD_SEARCH_MAX_WORDS ||
      new Set(words).size !== words.length ||
      words.some(
        (word) =>
          !/^[A-Z]+$/.test(word) ||
          word.length < 2 ||
          word.length > MEDITATION_WORD_SEARCH_MAX_WORD_LENGTH,
      )
    )
      return activity;
    const lines = instruction.split(/\r?\n/);
    let start = -1;
    let end = -1;
    for (let index = 0; index < lines.length; index++) {
      if (/^[A-ZÀ-Ü\s]{4,}$/.test(lines[index].trim())) {
        if (start < 0) start = index;
        end = index + 1;
      } else if (start >= 0) {
        if (end - start >= 3) break;
        start = -1;
      }
    }
    if (start < 0 || end - start < 3) return activity;
    const width =
      Math.max(...words.map((word) => word.length)) +
      MEDITATION_WORD_SEARCH_GRID_PADDING;
    const height = Math.max(
      words.length + MEDITATION_WORD_SEARCH_GRID_PADDING,
      3,
    );
    const grid = Array.from({ length: height }, (_, row) =>
      Array.from(
        { length: width },
        (_, column) =>
          MEDITATION_WORD_SEARCH_FILLER[
            (row * width + column) % MEDITATION_WORD_SEARCH_FILLER.length
          ],
      ),
    );
    const positions = words.map((word, index) => {
      const offset = index % (width - word.length + 1);
      const row = index + 1;
      Array.from(word).forEach((letter, column) => {
        grid[row][offset + column] = letter;
      });
      return `${word}: linha ${row + 1}, coluna ${offset + 1} até coluna ${offset + word.length} (esquerda para direita).`;
    });
    const correctedInstruction = [
      ...lines.slice(0, start),
      ...grid.map((row) => row.join(' ')),
      ...lines.slice(end),
    ].join('\n');
    if (meditationWordSearchIssue(correctedInstruction)) return activity;
    repairedIds.add(
      typeof activity.id === 'string'
        ? activity.id
        : typeof activity.number === 'number'
          ? String(activity.number)
          : String(index + 1),
    );
    return {
      ...activity,
      instruction: correctedInstruction,
      answer: positions.join('\n'),
    };
  });
  return {
    ...content,
    activities,
    ...(Array.isArray(content.printableAssets)
      ? {
          printableAssets: content.printableAssets.filter((value: unknown) => {
            if (!value || typeof value !== 'object') return true;
            const asset = value as MeditationJson;
            return typeof asset.id !== 'string' || !repairedIds.has(asset.id);
          }),
        }
      : {}),
  };
}
