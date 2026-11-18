import {
  MANUAL_WORK_SCENE_FOCUSES,
  MANUAL_WORK_SCENE_HISTORY_LIMIT,
} from '../constants/manual-work-scene.constants';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import { lessonAsObject } from './lesson-workflow.utils';

/**
 * The scenes already drawn for this item, oldest first, as negative
 * references for the next generation. `name` keeps every entry in the
 * bounded history sent to the model.
 */
export function manualWorkPreviousScenes(
  versions: ReadonlyArray<LessonJsonObject | null | undefined>,
): Array<{ name: string }> {
  const scenes = versions
    .map((content) => {
      const assets = lessonAsObject(content).printableAssets;
      const prompt = lessonAsObject(
        Array.isArray(assets) ? assets[0] : undefined,
      ).prompt;
      return typeof prompt === 'string' ? prompt.trim() : '';
    })
    .filter(Boolean);
  return [...new Set(scenes)]
    .slice(-MANUAL_WORK_SCENE_HISTORY_LIMIT)
    .map((name) => ({ name }));
}

/** The moment of the story this generation draws: the next one in the cycle. */
export function manualWorkSceneFocus(generationsSoFar: number): string {
  return MANUAL_WORK_SCENE_FOCUSES[
    Math.max(0, generationsSoFar) % MANUAL_WORK_SCENE_FOCUSES.length
  ];
}
