import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import {
  LessonCategory,
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
} from '../enums/lesson.enums';
import {
  LessonPublicationState,
  LessonView,
} from '../enums/lesson-failure-code.enum';

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
  /** Lessons still in the works (not published, not archived), newest first. */
  active: LessonResponseDto[];
  recent: LessonResponseDto[];
}

export class LessonPublicationResponseDto {
  lesson: LessonResponseDto;
  weekMaterialId: string;
}

export class LessonPublicationMaterialResponseDto {
  id: string;
  /** False when the page was deleted in Materiais Semanais. */
  exists: boolean;
  routePath: string | null;
  currentWeek: boolean;
}

export class LessonPublicationDuplicateResponseDto {
  id: string;
  title: string;
  routePath: string | null;
}

/** `GET /lessons/:id/publication-preview`. */
export class LessonPublicationPreviewResponseDto {
  /** Title the published page will receive. */
  title: string;
  isSpecial: boolean;
  /** PDFs the publication creates (one per item). */
  documentCount: number;
  /** Page already linked to the lesson; null when it was never published. */
  weekMaterial: LessonPublicationMaterialResponseDto | null;
  /** Existing materials for the same week (or same title, when special). */
  duplicates: LessonPublicationDuplicateResponseDto[];
}

export class LessonDeleteResponseDto {
  success: boolean;
  message: string;
}

export interface ToLessonResponseOptions {
  view?: LessonView;
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
  view: LessonView = LessonView.FULL,
): LessonStageResponseDto => {
  const allVersions = stage.versions ?? [];
  const filteredVersions =
    view === LessonView.COMPACT && stage.currentVersionId
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
    return LessonPublicationState.PUBLISHED;
  }
  if (lesson.status === LessonStatus.PUBLISHING) {
    return LessonPublicationState.PUBLISHING;
  }
  if (lesson.publicationFailureMessage) {
    return LessonPublicationState.FAILED;
  }
  return LessonPublicationState.IDLE;
};

export const toLessonResponse = (
  lesson: LessonEntity,
  options?: ToLessonResponseOptions,
): LessonResponseDto => {
  const view = options?.view ?? LessonView.FULL;
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
