import { OlderMeditationMechanic } from '../enums/older-meditation.enums';

/** Limits of the crossword the server lays out from the clue answers. */
export const OLDER_MEDITATION_CROSSWORD = {
  minimumWords: 2,
  maximumWords: 6,
  minimumLetters: 2,
  maximumLetters: 12,
  /** A grid needs three rows and columns to be recognised and printed. */
  minimumSide: 3,
  /** Widest grid that still fits beside the clues. */
  maximumSide: 14,
} as const;

/** Name that identifies each drawn puzzle in the printed text. */
export const OLDER_MEDITATION_PUZZLE_KEYWORD: Partial<
  Record<OlderMeditationMechanic, { pattern: RegExp; sentence: string }>
> = {
  [OlderMeditationMechanic.WORD_SEARCH]: {
    pattern: /caça[ -]palavras/i,
    sentence: 'Resolva o caça-palavras.',
  },
  [OlderMeditationMechanic.CROSSWORD]: {
    pattern: /cruzadinha/i,
    sentence: 'Resolva a cruzadinha.',
  },
};

/** Puzzles whose single subitem only repeats the command: it is not printed. */
export const OLDER_MEDITATION_SILENT_SUBITEM_MECHANICS: readonly OlderMeditationMechanic[] =
  [OlderMeditationMechanic.WORD_SEARCH, OlderMeditationMechanic.MAZE];

/**
 * Right/wrong statements with exactly these options print as "(   ) frase":
 * the child writes C or E, or marks the right ones, as in the printed sheets.
 */
export const OLDER_MEDITATION_MARK_OPTIONS = ['certo', 'errado'] as const;

/** Mechanics whose artwork is the exercise itself, not a scene of the story. */
export const OLDER_MEDITATION_EXECUTABLE_ART_MECHANICS: readonly OlderMeditationMechanic[] =
  [OlderMeditationMechanic.MAZE, OlderMeditationMechanic.SPOT_ERRORS];

/** Pastimes of the handmade sheets: every sheet carries at least one. */
export const OLDER_MEDITATION_PASTIME_MECHANICS: readonly OlderMeditationMechanic[] =
  [
    OlderMeditationMechanic.WORD_SEARCH,
    OlderMeditationMechanic.CROSSWORD,
    OlderMeditationMechanic.CODE,
    OlderMeditationMechanic.MAZE,
    OlderMeditationMechanic.INITIALS,
  ];

/**
 * Questions that print a grid or a code table take the full width or the
 * side column themselves: they never carry artwork.
 */
export const OLDER_MEDITATION_TEXT_ONLY_MECHANICS: readonly OlderMeditationMechanic[] =
  [
    OlderMeditationMechanic.WORD_SEARCH,
    OlderMeditationMechanic.CROSSWORD,
    OlderMeditationMechanic.CODE,
  ];

/** A single picture a sheet: one scene, never a set of small pictures. */
export const OLDER_MEDITATION_MAXIMUM_IMAGES = 1;
