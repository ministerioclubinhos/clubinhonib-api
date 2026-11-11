import { LessonEntity } from '../entities/lesson.entity';
import type { LessonEventDigestSource } from '../types/lesson-generation.types';

export function lessonEventDigestSource(
  lesson: LessonEntity,
  commentCount = (lesson.comments ?? []).length,
): LessonEventDigestSource {
  return {
    id: lesson.id,
    status: lesson.status,
    weekMaterialId: lesson.weekMaterialId ?? null,
    publicationFailureMessage: lesson.publicationFailureMessage ?? null,
    stages: (lesson.stages ?? []).map((stage) => ({
      type: stage.type,
      status: stage.status,
      lockVersion: stage.lockVersion ?? 0,
      currentVersionId: stage.currentVersionId ?? null,
      failureCode: stage.failureCode ?? null,
      failureMessage: stage.failureMessage ?? null,
    })),
    commentCount,
  };
}

/**
 * Fingerprint of everything a studio screen renders from a lesson. Built from
 * `lessons` + `lesson_stages` columns only, so polling never loads versions.
 */
export function lessonEventDigest(source: LessonEventDigestSource): string {
  const stagePart = [...source.stages]
    .sort((a, b) => a.type.localeCompare(b.type))
    .map(
      (stage) =>
        `${stage.type}:${stage.status}:${stage.lockVersion}:${stage.currentVersionId ?? ''}:${stage.failureCode ?? ''}:${stage.failureMessage ?? ''}`,
    )
    .join('|');
  return [
    source.id,
    source.status,
    source.weekMaterialId ?? '',
    source.publicationFailureMessage ?? '',
    stagePart,
    String(source.commentCount),
  ].join('::');
}
