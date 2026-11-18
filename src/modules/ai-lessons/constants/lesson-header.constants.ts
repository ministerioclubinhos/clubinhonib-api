import { join } from 'node:path';

/** Header artwork packaged with the API (copied to `dist` by `nest build`). */
export const LESSON_HEADER_ASSETS_DIRECTORY = join(__dirname, '..', 'assets');

export enum LessonHeaderImage {
  LESSON_LEFT = 'LESSON_LEFT',
  LESSON_RIGHT = 'LESSON_RIGHT',
  MEDITATION_LEFT = 'MEDITATION_LEFT',
}

/**
 * `env`: optional override, resolved from the working directory.
 * `file`: packaged default. `legacyPath`: sibling frontend checkout used
 * before the artwork was packaged, kept as a last resort for local setups.
 */
export const LESSON_HEADER_IMAGES: Readonly<
  Record<LessonHeaderImage, { env: string; file: string; legacyPath: string }>
> = {
  [LessonHeaderImage.LESSON_LEFT]: {
    env: 'LESSON_HEADER_LEFT_PATH',
    file: 'header-left.png',
    legacyPath: '../clubinhonib-app/public/header_esquerdo.png',
  },
  [LessonHeaderImage.LESSON_RIGHT]: {
    env: 'LESSON_HEADER_RIGHT_PATH',
    file: 'header-right.png',
    legacyPath: '../clubinhonib-app/public/header_direito.png',
  },
  [LessonHeaderImage.MEDITATION_LEFT]: {
    env: 'MEDITATION_HEADER_LEFT_PATH',
    file: 'header-meditation.png',
    legacyPath: '../clubinhonib-app/public/header_esquerdo_meditação.png',
  },
};
