import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { LESSON_PRINTABLE_ASSET_STAGES } from '../constants/lesson-workflow.constants';
import { LessonStageType } from '../enums/lesson.enums';
import { LessonGenerationAbortedError } from './lesson-ai-failure.utils';

export function lessonNotFound(): AppNotFoundException {
  return new AppNotFoundException(
    ErrorCode.LESSON_NOT_FOUND,
    'Lição não encontrada.',
  );
}

export function stageNotFound(): AppNotFoundException {
  return new AppNotFoundException(
    ErrorCode.LESSON_STAGE_NOT_FOUND,
    'Etapa não encontrada.',
  );
}

/** Stops an attempt that lost its lease or whose process is shutting down. */
export function throwIfGenerationAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new LessonGenerationAbortedError();
}

/** Structured-content key that holds the artwork of a stage. */
export function lessonAssetListKey(
  type: LessonStageType,
): 'assets' | 'printableAssets' {
  return LESSON_PRINTABLE_ASSET_STAGES.includes(type)
    ? 'printableAssets'
    : 'assets';
}
