import { LESSON_GENERATION_PROGRESS } from '../constants/lesson-generation-progress.constants';
import { LessonGenerationPhase } from '../enums/lesson-generation-phase.enum';
import { LessonStageStatus, LessonStageType } from '../enums/lesson.enums';
import type { LessonEntity } from '../entities/lesson.entity';
import type { LessonGenerationProgress } from '../types/lesson-generation-progress.types';

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** Reads a stored record; anything malformed is treated as absent. */
export function parseGenerationProgress(
  raw: string | null,
): LessonGenerationProgress | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const { stage, phase } = record;
  if (
    !isText(record.lessonId) ||
    !isText(record.startedAt) ||
    !isText(record.updatedAt) ||
    !Object.values(LessonStageType).includes(stage as LessonStageType) ||
    !Object.values(LessonGenerationPhase).includes(
      phase as LessonGenerationPhase,
    ) ||
    !isCount(record.totalImages) ||
    !isCount(record.completedImages)
  )
    return null;
  return {
    lessonId: record.lessonId,
    theme: typeof record.theme === 'string' ? record.theme : '',
    stage: stage as LessonStageType,
    phase: phase as LessonGenerationPhase,
    totalImages: record.totalImages,
    completedImages: Math.min(record.completedImages, record.totalImages),
    requestedById:
      typeof record.requestedById === 'string' ? record.requestedById : '',
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Share of the work already done: the text counts as one step and each image
 * as another. Without images there is nothing to count, so it is unknown.
 */
export function generationPercent(
  progress: Pick<
    LessonGenerationProgress,
    'phase' | 'totalImages' | 'completedImages'
  >,
): number | null {
  if (progress.totalImages <= 0) return null;
  const textDone = progress.phase === LessonGenerationPhase.WRITING ? 0 : 1;
  const done = textDone + progress.completedImages;
  return Math.min(
    LESSON_GENERATION_PROGRESS.maxPercent,
    Math.round((done / (progress.totalImages + 1)) * 100),
  );
}

/** Changes whenever the progress a screen renders changes. */
export function generationProgressDigest(
  progress: LessonGenerationProgress | null,
): string {
  return progress
    ? `${progress.stage}:${progress.phase}:${progress.completedImages}/${progress.totalImages}`
    : '';
}

/** The database decides whether a stage is generating; Redis only adds detail. */
export function generationOfLesson(
  lesson: LessonEntity,
  progress: LessonGenerationProgress | null | undefined,
): LessonGenerationProgress | null {
  if (!progress || progress.lessonId !== lesson.id) return null;
  const generating = (lesson.stages ?? []).some(
    (stage) =>
      stage.type === progress.stage &&
      stage.status === LessonStageStatus.GENERATING,
  );
  return generating ? progress : null;
}
