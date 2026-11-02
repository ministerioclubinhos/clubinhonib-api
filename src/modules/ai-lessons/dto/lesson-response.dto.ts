import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import {
  LessonCategory,
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
} from '../enums/lesson.enums';

export class LessonVersionResponseDto {
  id: string;
  versionNumber: number;
  tiptapAstJson: Record<string, unknown>;
  structuredDataJson: Record<string, unknown> | null;
  changeSummary: string;
  createdAt: Date;
}

export class LessonStageResponseDto {
  id: string;
  type: LessonStageType;
  status: LessonStageStatus;
  currentVersionId: string | null;
  lockVersion: number;
  failureCode: string | null;
  failureMessage: string | null;
  versions: LessonVersionResponseDto[];
}

export type LessonPublicationState =
  | 'IDLE'
  | 'PUBLISHING'
  | 'FAILED'
  | 'PUBLISHED';

export class LessonResponseDto {
  id: string;
  theme: string;
  biblicalReference: string;
  weekNumber: number | null;
  category: LessonCategory;
  specialContext: string | null;
  status: LessonStatus;
  weekMaterialId: string | null;
  publicationFailureMessage: string | null;
  publicationState: LessonPublicationState;
  createdAt: Date;
  updatedAt: Date;
  stages: LessonStageResponseDto[];
  comments: LessonCommentResponseDto[];
}

export class LessonCommentResponseDto {
  id: string;
  sectionKey: string;
  commentText: string;
  isResolved: boolean;
  authorId: string;
  createdAt: Date;
}

export class LessonListResponseDto {
  items: LessonResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class LessonDashboardResponseDto {
  total: number;
  byStatus: Record<LessonStatus, number>;
  recent: LessonResponseDto[];
}

export class LessonPublicationResponseDto {
  lesson: LessonResponseDto;
  weekMaterialId: string;
}

export interface ToLessonResponseOptions {
  view?: 'full' | 'compact';
}

const mapVersion = (
  version: LessonVersionEntity,
): LessonVersionResponseDto => ({
  id: version.id,
  versionNumber: version.versionNumber,
  tiptapAstJson: version.tiptapAstJson,
  structuredDataJson: version.structuredDataJson,
  changeSummary: version.changeSummary,
  createdAt: version.createdAt,
});

const mapStage = (
  stage: LessonStageEntity,
  view: 'full' | 'compact' = 'full',
): LessonStageResponseDto => {
  const allVersions = stage.versions ?? [];
  const filteredVersions =
    view === 'compact' && stage.currentVersionId
      ? allVersions.filter((version) => version.id === stage.currentVersionId)
      : allVersions;
  return {
    id: stage.id,
    type: stage.type,
    status: stage.status,
    currentVersionId: stage.currentVersionId,
    lockVersion: stage.lockVersion,
    failureCode: stage.failureCode,
    failureMessage: stage.failureMessage,
    versions: filteredVersions.map(mapVersion),
  };
};

const resolvePublicationState = (
  lesson: LessonEntity,
): LessonPublicationState => {
  if (lesson.status === LessonStatus.PUBLISHED || lesson.weekMaterialId) {
    return 'PUBLISHED';
  }
  if (lesson.status === LessonStatus.PUBLISHING) {
    return 'PUBLISHING';
  }
  if (lesson.publicationFailureMessage) {
    return 'FAILED';
  }
  return 'IDLE';
};

export const toLessonResponse = (
  lesson: LessonEntity,
  options?: ToLessonResponseOptions,
): LessonResponseDto => {
  const view = options?.view ?? 'full';
  return {
    id: lesson.id,
    theme: lesson.theme,
    biblicalReference: lesson.biblicalReference,
    weekNumber: lesson.weekNumber ?? null,
    category: lesson.category ?? LessonCategory.REGULAR,
    specialContext: lesson.specialContext ?? null,
    status: lesson.status,
    weekMaterialId: lesson.weekMaterialId,
    publicationFailureMessage: lesson.publicationFailureMessage ?? null,
    publicationState: resolvePublicationState(lesson),
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
    stages: (lesson.stages ?? []).map((stage) => mapStage(stage, view)),
    comments: (lesson.comments ?? []).map((comment) => ({
      id: comment.id,
      sectionKey: comment.sectionKey,
      commentText: comment.commentText,
      isResolved: comment.isResolved,
      authorId: comment.authorId,
      createdAt: comment.createdAt,
    })),
  };
};

export const computeLessonEventDigest = (lesson: LessonEntity): string => {
  const stagePart = (lesson.stages ?? [])
    .map(
      (stage) =>
        `${stage.type}:${stage.status}:${stage.lockVersion ?? 0}:${stage.currentVersionId ?? ''}:${stage.failureCode ?? ''}:${stage.failureMessage ?? ''}`,
    )
    .join('|');
  const commentCount = (lesson.comments ?? []).length;
  return [
    lesson.id,
    lesson.status,
    lesson.weekMaterialId ?? '',
    lesson.publicationFailureMessage ?? '',
    stagePart,
    String(commentCount),
  ].join('::');
};
