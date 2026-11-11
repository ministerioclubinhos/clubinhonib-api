import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AppBusinessException,
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import {
  LESSON_REVIEW_STATUSES,
  LESSON_STAGE_COMPLETED_STATUSES,
  LESSON_STAGE_EDITABLE_STATUSES,
  LESSON_STAGE_OUTDATED_STATUSES,
} from '../constants/lesson-workflow.constants';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import {
  getLessonStageOrder,
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
} from '../enums/lesson.enums';
import { LessonWorkflowAction } from '../enums/lesson-failure-code.enum';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { assertStageReadyForCompletionOrPublication } from '../utils/lesson-canonical-content.utils';
import {
  assertLessonMutable,
  assertPreviousStageCompleted,
} from '../utils/lesson-workflow.utils';
import { GetLessonService } from './get-lesson.service';
import { LessonStudioSupportService } from './lesson-studio-support.service';
import {
  lessonNotFound,
  stageNotFound,
} from '../utils/lesson-studio-errors.utils';

/** Production and review transitions of a stage: conclude, submit, approve, return, reopen and resolve comments. */
@Injectable()
export class UpdateLessonReviewService {
  constructor(
    private readonly repo: AiLessonsRepository,
    private readonly support: LessonStudioSupportService,
    private readonly lessons: GetLessonService,
  ) {}

  async completeProductionStage(
    id: string,
    type: LessonStageType,
    lockVersion: number,
    options: { acknowledgeStale?: boolean; actorId?: string } = {},
  ): Promise<LessonEntity> {
    let versionId: string | undefined;
    await this.repo.runInTransaction(async (manager) => {
      const lesson = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!lesson) throw lessonNotFound();
      assertLessonMutable(
        lesson,
        'Aguarde a geração ou publicação em andamento antes de concluir a etapa.',
      );
      const stage = lesson.stages.find((item) => item.type === type);
      if (!stage?.currentVersionId)
        throw new AppBusinessException(
          ErrorCode.LESSON_STAGE_NOT_READY,
          'Etapa sem conteúdo para concluir.',
        );
      if (stage.lockVersion !== lockVersion)
        throw new AppConflictException(
          ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
          'Esta etapa foi alterada em outra sessão. Recarregue antes de concluir.',
        );
      if (!LESSON_STAGE_EDITABLE_STATUSES.includes(stage.status))
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'Somente uma etapa em produção pode ser concluída.',
        );
      assertPreviousStageCompleted(lesson, type);
      if (
        LESSON_STAGE_OUTDATED_STATUSES.includes(stage.status) &&
        !options.acknowledgeStale &&
        (await this.upstreamChangedSince(lesson, stage, manager))
      )
        throw new AppConflictException(
          ErrorCode.LESSON_STAGE_STALE_UPSTREAM,
          'Este item foi produzido a partir de uma versão anterior dos itens anteriores. Gere-o novamente, edite o conteúdo ou confirme que ele continua válido antes de concluir.',
        );
      const currentVersion = await this.requireCurrentVersion(
        stage,
        manager,
        'Esta etapa foi alterada em outra sessão. Recarregue antes de concluir.',
      );
      assertStageReadyForCompletionOrPublication(
        type,
        currentVersion.structuredDataJson,
        currentVersion.tiptapAstJson,
      );
      versionId = currentVersion.id;
      stage.status = LessonStageStatus.PRODUCER_APPROVED;
      stage.approvedAt = null;
      stage.approvedById = null;
      await this.repo.updateStage(
        stage.id,
        {
          status: LessonStageStatus.PRODUCER_APPROVED,
          approvedAt: null,
          approvedById: null,
          failureCode: null,
          failureMessage: null,
        },
        manager,
      );
      await this.support.syncLessonStatus(lesson, manager);
    });
    this.support.audit(
      LessonWorkflowAction.COMPLETE_STAGE,
      id,
      options.actorId,
      {
        stage: type,
        versionId,
      },
    );
    return this.lessons.getById(id);
  }

  /**
   * Whether any earlier item got a newer current version than this item's.
   * Versions are immutable and an identical save creates none, so a newer
   * upstream version means the item was produced from different content.
   */
  private async upstreamChangedSince(
    lesson: LessonEntity,
    stage: LessonStageEntity,
    manager: EntityManager,
  ): Promise<boolean> {
    if (!stage.currentVersionId) return false;
    const stageOrder = getLessonStageOrder(lesson.category);
    const index = stageOrder.indexOf(stage.type);
    const upstreamIds = lesson.stages
      .filter(
        (item) =>
          stageOrder.indexOf(item.type) < index &&
          Boolean(item.currentVersionId),
      )
      .map((item) => item.currentVersionId as string);
    if (!upstreamIds.length) return false;
    const createdAt = await this.repo.findVersionCreationDates(
      [stage.currentVersionId, ...upstreamIds],
      manager,
    );
    const own = createdAt.get(stage.currentVersionId);
    if (!own) return false;
    return upstreamIds.some((versionId) => {
      const upstream = createdAt.get(versionId);
      return upstream !== undefined && upstream.getTime() > own.getTime();
    });
  }

  private async requireCurrentVersion(
    stage: LessonStageEntity,
    manager: EntityManager,
    staleMessage: string,
  ): Promise<LessonVersionEntity> {
    const version = stage.currentVersionId
      ? await this.repo.findVersionById(stage.currentVersionId, manager)
      : null;
    if (!version || version.stageId !== stage.id)
      throw new AppConflictException(
        ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
        staleMessage,
      );
    return version;
  }

  async submitPackageReview(
    id: string,
    actorId?: string,
  ): Promise<LessonEntity> {
    await this.repo.runInTransaction(async (manager) => {
      const lesson = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!lesson) throw lessonNotFound();
      if (lesson.status !== LessonStatus.PACKAGE_READY)
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'Somente um pacote concluído pode ser submetido para revisão.',
        );
      if (
        lesson.stages.length !== getLessonStageOrder(lesson.category).length ||
        !lesson.stages.every(
          (stage) =>
            Boolean(stage.currentVersionId) &&
            LESSON_STAGE_COMPLETED_STATUSES.includes(stage.status),
        )
      )
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'Conclua todos os itens antes de submeter o pacote para aprovação final.',
        );
      for (const stage of lesson.stages.filter(
        (item) => item.status === LessonStageStatus.PRODUCER_APPROVED,
      )) {
        stage.status = LessonStageStatus.IN_REVIEW;
        await this.repo.updateStage(
          stage.id,
          { status: LessonStageStatus.IN_REVIEW },
          manager,
        );
      }
      await this.support.syncLessonStatus(lesson, manager);
    });
    this.support.audit(LessonWorkflowAction.SUBMIT_PACKAGE, id, actorId);
    return this.lessons.getById(id);
  }

  async approveStage(
    id: string,
    type: LessonStageType,
    userId: string,
    lockVersion: number,
  ): Promise<LessonEntity> {
    let versionId: string | undefined;
    await this.repo.runInTransaction(async (manager) => {
      const lesson = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!lesson) throw lessonNotFound();
      assertLessonMutable(
        lesson,
        'Aguarde a geração ou publicação em andamento antes de revisar.',
      );
      if (!LESSON_REVIEW_STATUSES.includes(lesson.status))
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'Itens só podem ser aprovados durante a revisão final.',
        );
      const stage = lesson.stages.find((item) => item.type === type);
      if (!stage) throw stageNotFound();
      if (
        !stage.currentVersionId ||
        stage.status !== LessonStageStatus.IN_REVIEW
      )
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'Este item não está disponível para aprovação.',
        );
      const staleMessage =
        'Este item foi atualizado em outra sessão. Recarregue antes de aprovar.';
      if (stage.lockVersion !== lockVersion)
        throw new AppConflictException(
          ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
          staleMessage,
        );
      // Always validated against the version read under the lesson lock.
      const currentVersion = await this.requireCurrentVersion(
        stage,
        manager,
        staleMessage,
      );
      assertStageReadyForCompletionOrPublication(
        type,
        currentVersion.structuredDataJson,
        currentVersion.tiptapAstJson,
      );
      versionId = currentVersion.id;
      stage.status = LessonStageStatus.APPROVED;
      stage.approvedById = userId;
      stage.approvedAt = new Date();
      await this.repo.updateStage(
        stage.id,
        {
          status: LessonStageStatus.APPROVED,
          approvedById: userId,
          approvedAt: stage.approvedAt,
        },
        manager,
      );
      await this.support.syncLessonStatus(lesson, manager);
    });
    this.support.audit(LessonWorkflowAction.APPROVE_STAGE, id, userId, {
      stage: type,
      versionId,
    });
    return this.lessons.getById(id);
  }

  async requestChanges(
    id: string,
    type: LessonStageType,
    note: string | undefined,
    userId: string,
    lockVersion: number,
  ): Promise<LessonEntity> {
    return this.returnStage(id, type, note, userId, lockVersion, false);
  }

  /**
   * Reopens an approved item of a package that is ready for publication, so a
   * mistake noticed after the last approval does not force publish-or-delete.
   */
  async reopenStage(
    id: string,
    type: LessonStageType,
    note: string | undefined,
    userId: string,
    lockVersion: number,
  ): Promise<LessonEntity> {
    return this.returnStage(id, type, note, userId, lockVersion, true);
  }

  private async returnStage(
    id: string,
    type: LessonStageType,
    note: string | undefined,
    userId: string,
    lockVersion: number,
    reopen: boolean,
  ): Promise<LessonEntity> {
    const feedback = note?.trim();
    if (!feedback)
      throw new AppBusinessException(
        ErrorCode.LESSON_INVALID_REQUEST,
        'Descreva os ajustes necessários antes de devolver o item.',
      );
    let versionId: string | undefined;
    await this.repo.runInTransaction(async (manager) => {
      const lesson = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!lesson) throw lessonNotFound();
      assertLessonMutable(
        lesson,
        'Aguarde a geração ou publicação em andamento antes de revisar.',
      );
      const allowedLessonStatuses = reopen
        ? [LessonStatus.READY_FOR_PUBLICATION]
        : LESSON_REVIEW_STATUSES;
      if (!allowedLessonStatuses.includes(lesson.status))
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          reopen
            ? 'Somente um pacote pronto para publicação pode ter um item reaberto.'
            : 'Ajustes só podem ser solicitados durante a revisão final.',
        );
      const stage = lesson.stages.find((item) => item.type === type);
      if (!stage) throw stageNotFound();
      const expectedStageStatus = reopen
        ? LessonStageStatus.APPROVED
        : LessonStageStatus.IN_REVIEW;
      if (!stage.currentVersionId || stage.status !== expectedStageStatus)
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'Este item não está disponível para revisão.',
        );
      const staleMessage =
        'Este item foi atualizado em outra sessão. Recarregue antes de devolver.';
      if (stage.lockVersion !== lockVersion)
        throw new AppConflictException(
          ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
          staleMessage,
        );
      // The reviewer returns exactly the version read under the lock. The
      // readiness check is not applied: a broken item must be returnable.
      const currentVersion = await this.requireCurrentVersion(
        stage,
        manager,
        staleMessage,
      );
      versionId = currentVersion.id;
      stage.status = LessonStageStatus.CHANGES_REQUESTED;
      stage.approvedAt = null;
      stage.approvedById = null;
      await this.repo.updateStage(
        stage.id,
        {
          status: LessonStageStatus.CHANGES_REQUESTED,
          approvedAt: null,
          approvedById: null,
        },
        manager,
      );
      await this.repo.saveComment(
        this.repo.createComment({
          lesson: { id: lesson.id } as LessonEntity,
          sectionKey: type,
          commentText: feedback,
          isResolved: false,
          authorId: userId,
        }),
        manager,
      );
      await this.support.syncLessonStatus(lesson, manager);
    });
    this.support.audit(
      reopen
        ? LessonWorkflowAction.REOPEN_STAGE
        : LessonWorkflowAction.REQUEST_CHANGES,
      id,
      userId,
      { stage: type, versionId },
    );
    return this.lessons.getById(id);
  }

  async resolveComment(
    id: string,
    commentId: string,
    actorId?: string,
  ): Promise<LessonEntity> {
    const resolved = await this.repo.resolveComment(id, commentId);
    if (!resolved)
      throw new AppNotFoundException(
        ErrorCode.COMMENT_NOT_FOUND,
        'Comentário não encontrado nesta lição.',
      );
    this.support.audit(LessonWorkflowAction.RESOLVE_COMMENT, id, actorId, {
      commentId,
    });
    return this.lessons.getById(id);
  }
}
