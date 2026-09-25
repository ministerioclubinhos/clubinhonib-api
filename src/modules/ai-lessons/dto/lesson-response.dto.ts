import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import {
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
  failureMessage: string | null;
  versions: LessonVersionResponseDto[];
}

export class LessonResponseDto {
  id: string;
  theme: string;
  biblicalReference: string;
  weekNumber: number;
  status: LessonStatus;
  weekMaterialId: string | null;
  createdAt: Date;
  updatedAt: Date;
  stages: LessonStageResponseDto[];
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

const mapStage = (stage: LessonStageEntity): LessonStageResponseDto => ({
  id: stage.id,
  type: stage.type,
  status: stage.status,
  currentVersionId: stage.currentVersionId,
  lockVersion: stage.lockVersion,
  failureMessage: stage.failureMessage,
  versions: (stage.versions ?? []).map(mapVersion),
});

export const toLessonResponse = (lesson: LessonEntity): LessonResponseDto => ({
  id: lesson.id,
  theme: lesson.theme,
  biblicalReference: lesson.biblicalReference,
  weekNumber: lesson.weekNumber,
  status: lesson.status,
  weekMaterialId: lesson.weekMaterialId,
  createdAt: lesson.createdAt,
  updatedAt: lesson.updatedAt,
  stages: (lesson.stages ?? []).map(mapStage),
});
