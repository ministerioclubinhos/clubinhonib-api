import { LESSON_GAME_SUMMARY_ASSET_ID } from '../constants/lesson-workflow.constants';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import { lessonString } from '../utils';

/**
 * True when the fun game carries the single compiled image (current format).
 * Games generated before it keep one instructional image per step.
 */
export function isGameSummaryAssetList(assets: unknown): boolean {
  if (!Array.isArray(assets) || assets.length !== 1) return false;
  const [asset] = assets as unknown[];
  return (
    Boolean(asset) &&
    typeof asset === 'object' &&
    lessonString((asset as LessonJsonObject).id).trim() ===
      LESSON_GAME_SUMMARY_ASSET_ID
  );
}
