import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { LESSON_ASSET_CLEANUP_CONCURRENCY } from '../constants/lesson-workflow.constants';
import { LessonEntity } from '../entities/lesson.entity';
import {
  getLessonStageOrder,
  LessonStageStatus,
  LessonStageType,
} from '../enums/lesson.enums';
import { LessonWorkflowAction } from '../enums/lesson-failure-code.enum';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import {
  isLessonInReviewCycle,
  recomputeLessonStatus,
  settleWithConcurrency,
} from '../utils/lesson-workflow.utils';

/** Shared write-side helpers of the studio: aggregate status, downstream invalidation, S3 cleanup and the workflow audit trail. */
@Injectable()
export class LessonStudioSupportService {
  private readonly logger = new Logger(LessonStudioSupportService.name);

  constructor(
    private readonly repo: AiLessonsRepository,
    private readonly s3: AwsS3Service,
    private readonly media: MediaItemProcessor,
  ) {}

  /** Recomputes and persists the aggregate status from the stages in memory. */
  async syncLessonStatus(
    lesson: LessonEntity,
    manager?: EntityManager,
  ): Promise<void> {
    lesson.status = recomputeLessonStatus(
      lesson.category,
      lesson.stages,
      lesson.status,
    );
    await this.repo.updateLesson(lesson.id, { status: lesson.status }, manager);
  }

  /**
   * Marks the items after `type` as outdated when `type` got new content.
   *
   * Inside a review cycle nothing is invalidated: a correction touches only
   * its own item, and what the reviewer holds, approved or returned is never
   * taken from them. `previousStatus` is the status the edited item had before
   * the change (the caller already moved it to DRAFT), so a correction of the
   * only returned item still counts as part of the cycle.
   */
  async invalidateDownstream(
    lesson: LessonEntity,
    type: LessonStageType,
    manager?: EntityManager,
    previousStatus?: LessonStageStatus,
  ): Promise<void> {
    const stageOrder = getLessonStageOrder(lesson.category);
    const index = stageOrder.indexOf(type);
    const reviewCycle = isLessonInReviewCycle([
      previousStatus,
      ...lesson.stages.map((item) => item.status),
    ]);
    const outdated = reviewCycle
      ? []
      : lesson.stages.filter(
          (item) =>
            stageOrder.indexOf(item.type) > index &&
            item.status !== LessonStageStatus.NOT_STARTED,
        );
    for (const stage of outdated) {
      stage.status = LessonStageStatus.STALE;
      stage.approvedAt = null;
      stage.approvedById = null;
      await this.repo.updateStage(
        stage.id,
        {
          status: LessonStageStatus.STALE,
          approvedAt: null,
          approvedById: null,
        },
        manager,
      );
    }
    const edited = lesson.stages.find((item) => item.type === type);
    if (edited && edited.status === LessonStageStatus.GENERATING)
      edited.status = LessonStageStatus.DRAFT;
    await this.syncLessonStatus(lesson, manager);
  }

  /**
   * Best-effort removal of S3 objects with bounded parallelism. Never throws:
   * a leftover object is logged as an orphan instead of failing the caller.
   */
  async discardUploads(
    urls: readonly string[],
    keepMediaReferenced = false,
  ): Promise<void> {
    const unique = [...new Set(urls.filter(Boolean))];
    if (!unique.length) return;
    if (!keepMediaReferenced) {
      await settleWithConcurrency(
        unique,
        LESSON_ASSET_CLEANUP_CONCURRENCY,
        (url) => this.s3.delete(url),
        (url, error) => this.logOrphan(url, error),
      );
      return;
    }
    const groups = Array.from(
      { length: LESSON_ASSET_CLEANUP_CONCURRENCY },
      (_, group) =>
        unique.filter(
          (_url, index) => index % LESSON_ASSET_CLEANUP_CONCURRENCY === group,
        ),
    ).filter((group) => group.length > 0);
    await Promise.all(
      groups.map((group) =>
        this.media
          .discardUnreferencedUploads(group, (url) => this.s3.delete(url))
          .catch((error: unknown) => {
            group.forEach((url) => this.logOrphan(url, error));
          }),
      ),
    );
  }

  private logOrphan(url: string, error: unknown): void {
    this.logger.error(`ÓRFÃO NO S3: falha ao remover ${url}: ${String(error)}`);
  }

  /**
   * Workflow trail in the structured log. The HTTP audit interceptor records
   * the request and its actor; this adds the domain facts it cannot see.
   */
  audit(
    action: LessonWorkflowAction,
    lessonId: string,
    actorId?: string,
    details: {
      stage?: LessonStageType;
      versionId?: string;
      weekMaterialId?: string;
      commentId?: string;
    } = {},
  ): void {
    this.logger.log(
      `Estúdio: ação=${action} lição=${lessonId} ator=${actorId ?? 'sistema'}` +
        (details.stage ? ` etapa=${details.stage}` : '') +
        (details.versionId ? ` versão=${details.versionId}` : '') +
        (details.weekMaterialId ? ` material=${details.weekMaterialId}` : '') +
        (details.commentId ? ` comentário=${details.commentId}` : ''),
    );
  }
}
