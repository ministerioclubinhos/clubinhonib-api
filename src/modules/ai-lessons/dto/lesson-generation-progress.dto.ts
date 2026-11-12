import { LessonGenerationPhase } from '../enums/lesson-generation-phase.enum';
import { LessonStageType } from '../enums/lesson.enums';
import type { LessonGenerationProgress } from '../types/lesson-generation-progress.types';
import { generationPercent } from '../utils/lesson-generation-progress.utils';

/** Live progress of the stage being generated in a lesson. */
export class LessonGenerationProgressResponseDto {
  stage: LessonStageType;
  phase: LessonGenerationPhase;
  totalImages: number;
  completedImages: number;
  /** 0–99; null when the stage has no images to count. */
  percent: number | null;
  startedAt: string;
  updatedAt: string;
}

/** `GET /lessons/generations/active`. */
export class LessonActiveGenerationResponseDto extends LessonGenerationProgressResponseDto {
  lessonId: string;
  theme: string;
}

export const toGenerationProgressResponse = (
  progress: LessonGenerationProgress,
): LessonGenerationProgressResponseDto => ({
  stage: progress.stage,
  phase: progress.phase,
  totalImages: progress.totalImages,
  completedImages: progress.completedImages,
  percent: generationPercent(progress),
  startedAt: progress.startedAt,
  updatedAt: progress.updatedAt,
});

export const toActiveGenerationResponse = (
  progress: LessonGenerationProgress,
): LessonActiveGenerationResponseDto => ({
  ...toGenerationProgressResponse(progress),
  lessonId: progress.lessonId,
  theme: progress.theme,
});
