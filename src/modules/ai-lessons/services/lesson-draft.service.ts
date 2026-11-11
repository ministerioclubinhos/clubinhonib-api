import { Injectable } from '@nestjs/common';
import { GenerateLessonRequestDto } from '../dto/generate-lesson-request.dto';
import { GenerateStageRequestDto } from '../dto/generate-stage-request.dto';
import { QueryLessonsDto } from '../dto/query-lessons.dto';
import { SaveTiptapContentDto } from '../dto/save-tiptap-content.dto';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageType, LessonStatus } from '../enums/lesson.enums';
import type {
  LessonDraftPage,
  LessonPdfFile,
  LessonPublicationPreview,
  LessonPublicationResult,
} from '../types/lesson-generation.types';
import { CreateLessonService } from './create-lesson.service';
import { DeleteLessonService } from './delete-lesson.service';
import { ExportLessonPdfService } from './export-lesson-pdf.service';
import { GetLessonService } from './get-lesson.service';
import { GetLessonPublicationService } from './get-lesson-publication.service';
import { LessonGenerationService } from './lesson-generation.service';
import { PublishLessonService } from './publish-lesson.service';
import { UpdateLessonContentService } from './update-lesson-content.service';
import { UpdateLessonReviewService } from './update-lesson-review.service';

/**
 * Public contract of the studio for controllers and other modules. It holds no
 * rule of its own: each use case lives in its operation service.
 */
@Injectable()
export class LessonDraftService {
  constructor(
    private readonly creation: CreateLessonService,
    private readonly lessons: GetLessonService,
    private readonly generation: LessonGenerationService,
    private readonly content: UpdateLessonContentService,
    private readonly review: UpdateLessonReviewService,
    private readonly pdfExport: ExportLessonPdfService,
    private readonly publication: PublishLessonService,
    private readonly deletion: DeleteLessonService,
    private readonly publicationPreview: GetLessonPublicationService,
  ) {}

  create(dto: GenerateLessonRequestDto, userId: string): Promise<LessonEntity> {
    return this.creation.create(dto, userId);
  }

  getDrafts(query: QueryLessonsDto): Promise<LessonDraftPage<LessonEntity>> {
    return this.lessons.getDrafts(query);
  }

  getDashboard(): Promise<{
    total: number;
    byStatus: Record<LessonStatus, number>;
    recent: LessonEntity[];
  }> {
    return this.lessons.getDashboard();
  }

  getById(id: string): Promise<LessonEntity> {
    return this.lessons.getById(id);
  }

  getEventDigest(id: string): Promise<string> {
    return this.lessons.getEventDigest(id);
  }

  generateStage(
    id: string,
    dto: GenerateStageRequestDto,
    userId: string,
  ): Promise<LessonEntity> {
    return this.generation.generateStage(id, dto, userId);
  }

  saveContent(
    id: string,
    dto: SaveTiptapContentDto,
    userId: string,
  ): Promise<LessonEntity> {
    return this.content.saveContent(id, dto, userId);
  }

  completeProductionStage(
    id: string,
    type: LessonStageType,
    lockVersion: number,
    options: { acknowledgeStale?: boolean; actorId?: string } = {},
  ): Promise<LessonEntity> {
    return this.review.completeProductionStage(id, type, lockVersion, options);
  }

  submitPackageReview(id: string, actorId?: string): Promise<LessonEntity> {
    return this.review.submitPackageReview(id, actorId);
  }

  approveStage(
    id: string,
    type: LessonStageType,
    userId: string,
    lockVersion: number,
  ): Promise<LessonEntity> {
    return this.review.approveStage(id, type, userId, lockVersion);
  }

  requestChanges(
    id: string,
    type: LessonStageType,
    note: string | undefined,
    userId: string,
    lockVersion: number,
  ): Promise<LessonEntity> {
    return this.review.requestChanges(id, type, note, userId, lockVersion);
  }

  reopenStage(
    id: string,
    type: LessonStageType,
    note: string | undefined,
    userId: string,
    lockVersion: number,
  ): Promise<LessonEntity> {
    return this.review.reopenStage(id, type, note, userId, lockVersion);
  }

  resolveComment(
    id: string,
    commentId: string,
    actorId?: string,
  ): Promise<LessonEntity> {
    return this.review.resolveComment(id, commentId, actorId);
  }

  exportPdf(id: string): Promise<LessonPdfFile> {
    return this.pdfExport.exportPdf(id);
  }

  previewStagePdf(
    id: string,
    type: LessonStageType,
    expectedLockVersion?: number,
    expectedVersionId?: string,
  ): Promise<LessonPdfFile> {
    return this.pdfExport.previewStagePdf(
      id,
      type,
      expectedLockVersion,
      expectedVersionId,
    );
  }

  publishToWeekMaterial(
    id: string,
    actorId?: string,
  ): Promise<LessonPublicationResult<LessonEntity>> {
    return this.publication.publishToWeekMaterial(id, actorId);
  }

  getPublicationPreview(id: string): Promise<LessonPublicationPreview> {
    return this.publicationPreview.preview(id);
  }

  archive(id: string, actorId?: string): Promise<LessonEntity> {
    return this.publication.archive(id, actorId);
  }

  unarchive(id: string, actorId?: string): Promise<LessonEntity> {
    return this.publication.unarchive(id, actorId);
  }

  delete(
    id: string,
    actorId?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.deletion.delete(id, actorId);
  }
}
