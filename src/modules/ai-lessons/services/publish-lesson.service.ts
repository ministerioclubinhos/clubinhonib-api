import { Interval } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { CreateWeekMaterialsPageDto } from 'src/modules/pages/week-material-page/dto/create-week-material.dto';
import { WeekMaterialsPageCreateService } from 'src/modules/pages/week-material-page/services/create-week-material.service';
import { WeekMaterialsPageGetService } from 'src/modules/pages/week-material-page/services/get-week-material.service';
import {
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { LESSON_PUBLICATION_TITLES } from '../constants/lesson-publication.constants';
import { LESSON_PUBLICATION } from '../constants/lesson-workflow.constants';
import { LessonEntity } from '../entities/lesson.entity';
import {
  getLessonStageOrder,
  LessonStageStatus,
  LessonStatus,
} from '../enums/lesson.enums';
import { LessonWorkflowAction } from '../enums/lesson-failure-code.enum';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import type { LessonPublicationResult } from '../types/lesson-generation.types';
import {
  lessonPdfFileName,
  lessonPublicationDescription,
  lessonPublicationRoutePathSource,
  lessonPublicationTitle,
  publicPublicationFailureMessage,
  stagePdfUnavailable,
} from '../utils/lesson-workflow.utils';
import { weekMaterialOriginMarker } from 'src/modules/pages/week-material-page/utils';
import { GetLessonService } from './get-lesson.service';
import { LessonStudioSupportService } from './lesson-studio-support.service';
import { ExportLessonPdfService } from './export-lesson-pdf.service';
import { lessonNotFound } from '../utils/lesson-studio-errors.utils';

/** Publication to the weekly materials under a database lease, its crash recovery, and the archive transitions. */
@Injectable()
export class PublishLessonService {
  private readonly logger = new Logger(PublishLessonService.name);
  private readonly activePublications = new Set<string>();

  constructor(
    private readonly repo: AiLessonsRepository,
    private readonly weekMaterials: WeekMaterialsPageCreateService,
    private readonly weekMaterialsGet: WeekMaterialsPageGetService,
    private readonly support: LessonStudioSupportService,
    private readonly lessons: GetLessonService,
    private readonly pdfExport: ExportLessonPdfService,
  ) {}

  /**
   * Reconciles publications whose lease expired (crash or lost heartbeat).
   * Multi-instance safety comes from the lesson lock and the database lease.
   */
  @Interval(LESSON_PUBLICATION.RECONCILE_INTERVAL_MS)
  async resumeInterruptedPublications(): Promise<void> {
    let expired: LessonEntity[];
    try {
      expired = await this.repo.findExpiredPublishingLessons();
    } catch (error: unknown) {
      this.logger.warn(
        `Falha ao listar publicações interrompidas: ${String(error)}`,
      );
      return;
    }
    for (const lesson of expired) {
      if (this.activePublications.has(lesson.id)) continue;
      try {
        await this.reconcileInterruptedPublication(lesson.id);
      } catch (error: unknown) {
        // A failed lookup is not "no page": keep PUBLISHING and retry later.
        this.logger.warn(
          `Falha ao reconciliar a publicação da lição ${lesson.id}: ${String(error)}`,
        );
      }
    }
  }

  private async reconcileInterruptedPublication(
    lessonId: string,
  ): Promise<void> {
    await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(lessonId, manager);
      if (!locked || locked.status !== LessonStatus.PUBLISHING) return;
      if (await this.repo.isPublicationLeaseActive(lessonId, manager)) return;
      // Read under the lesson lock; an error aborts this reconciliation.
      const existing = await this.findExistingWeekMaterialPage(lessonId, true);
      if (existing) {
        await this.markPublished(locked, existing.id, manager);
        return;
      }
      await this.repo.updateLesson(
        locked.id,
        {
          status: LessonStatus.READY_FOR_PUBLICATION,
          publicationLeaseOwner: null,
          publicationLeaseUntil: null,
          publicationReservedVersionsJson: null,
          publicationFailureMessage: LESSON_PUBLICATION.INTERRUPTED_MESSAGE,
        },
        manager,
      );
    });
  }

  /**
   * Page already created for this lesson. Lookup errors propagate: "could not
   * check" must never be read as "there is no page".
   */
  private async findExistingWeekMaterialPage(
    lessonId: string,
    allowMarkerFallback: boolean,
  ): Promise<{ id: string } | null> {
    const direct =
      await this.weekMaterialsGet.findOneBySourceLessonId(lessonId);
    if (direct) return { id: direct.id };
    if (!allowMarkerFallback) return null;
    // Legacy pages predate `sourceLessonId`; the marker lives in an editable
    // description, so it is trusted only for an interrupted publication.
    const marker = weekMaterialOriginMarker(lessonId);
    const result = await this.weekMaterialsGet.findAllPaginated({
      searchString: marker,
      limit: LESSON_PUBLICATION.ORIGIN_MARKER_SEARCH_LIMIT,
    });
    const matches = (result?.data ?? []).filter((item) =>
      item.description?.includes(marker),
    );
    return matches.length === 1 ? { id: matches[0].id } : null;
  }

  private async markPublished(
    lesson: LessonEntity,
    weekMaterialId: string,
    manager: EntityManager,
  ): Promise<void> {
    lesson.status = LessonStatus.PUBLISHED;
    lesson.weekMaterialId = weekMaterialId;
    await this.repo.updateLesson(
      lesson.id,
      {
        status: LessonStatus.PUBLISHED,
        weekMaterialId,
        publicationLeaseOwner: null,
        publicationLeaseUntil: null,
        publicationReservedVersionsJson: null,
        publicationFailureMessage: null,
      },
      manager,
    );
  }

  /**
   * Whether the page linked to a published lesson still exists. Only "not
   * found" means it is gone; any other lookup error propagates.
   */
  private async publishedPageExists(weekMaterialId: string): Promise<boolean> {
    try {
      await this.weekMaterialsGet.findOnePage(weekMaterialId);
      return true;
    } catch (error: unknown) {
      if (error instanceof AppNotFoundException) return false;
      throw error;
    }
  }

  async publishToWeekMaterial(
    id: string,
    actorId?: string,
  ): Promise<LessonPublicationResult<LessonEntity>> {
    const attemptToken = randomUUID();
    const reservation = await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!locked) throw lessonNotFound();
      if (locked.status === LessonStatus.ARCHIVED)
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          LESSON_PUBLICATION.ARCHIVED_MESSAGE,
        );
      // A published lesson whose page was deleted in Materiais Semanais is
      // published again: its items are still approved.
      let republishing = false;
      if (locked.status === LessonStatus.PUBLISHED) {
        if (
          locked.weekMaterialId &&
          (await this.publishedPageExists(locked.weekMaterialId))
        )
          return { publishedId: locked.weekMaterialId };
        republishing = true;
      }
      const publishing = locked.status === LessonStatus.PUBLISHING;
      if (
        publishing &&
        (this.activePublications.has(id) ||
          (await this.repo.isPublicationLeaseActive(id, manager)))
      )
        throw new AppConflictException(
          ErrorCode.LESSON_PUBLICATION_IN_PROGRESS,
          'A publicação desta lição já está em andamento.',
        );
      const stageCount = getLessonStageOrder(locked.category).length;
      const publishable =
        (republishing ||
          [
            LessonStatus.READY_FOR_PUBLICATION,
            LessonStatus.PUBLISHING,
          ].includes(locked.status)) &&
        locked.stages.length === stageCount &&
        locked.stages.every(
          (stage) =>
            stage.status === LessonStageStatus.APPROVED &&
            Boolean(stage.currentVersionId),
        );
      if (!publishable)
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          `A publicação exige que os ${stageCount} itens tenham sido revisados e aprovados.`,
        );
      // Read under the lesson lock: a page may exist from an interrupted run.
      const existing = await this.findExistingWeekMaterialPage(id, publishing);
      if (existing) {
        await this.markPublished(locked, existing.id, manager);
        return { publishedId: existing.id };
      }
      if (republishing) {
        this.logger.warn(
          `Lição ${id}: material ${locked.weekMaterialId ?? 'sem vínculo'} não existe mais; publicando novamente.`,
        );
        locked.weekMaterialId = null;
        await this.repo.updateLesson(id, { weekMaterialId: null }, manager);
      }
      const reservedVersions: Record<string, string> = {};
      for (const stage of locked.stages)
        reservedVersions[stage.type] = stage.currentVersionId as string;
      await this.repo.reservePublication(
        id,
        attemptToken,
        LESSON_PUBLICATION.LEASE_SECONDS,
        reservedVersions,
        manager,
      );
      return { publishedId: null, reservedVersions };
    });
    if (reservation.publishedId) {
      return {
        lesson: await this.lessons.getById(id),
        weekMaterialId: reservation.publishedId,
      };
    }

    this.activePublications.add(id);
    let leaseLost = false;
    const heartbeat = setInterval(() => {
      this.repo
        .renewPublicationLease(
          id,
          attemptToken,
          LESSON_PUBLICATION.LEASE_SECONDS,
        )
        .then((renewed) => {
          if (renewed === false) leaseLost = true;
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Falha ao renovar a lease de publicação da lição ${id}: ${String(error)}`,
          );
        });
    }, LESSON_PUBLICATION.HEARTBEAT_INTERVAL_MS);
    heartbeat.unref();

    let createdPageId: string | null = null;
    try {
      // One load serves the eight renders; versions are fenced by the reservation.
      const lesson = await this.lessons.getById(id);
      const dto = new CreateWeekMaterialsPageDto();
      dto.pageTitle = lessonPublicationTitle(lesson);
      dto.pageSubtitle = lesson.biblicalReference;
      dto.pageDescription = lessonPublicationDescription(lesson);
      dto.sourceLessonId = lesson.id;
      dto.documents = [];
      const files: Record<string, Express.Multer.File> = {};
      // Render every approved item before creating the page or uploading files.
      for (const type of getLessonStageOrder(lesson.category)) {
        const { pdfBuffer } = await this.pdfExport
          .renderStagePdf(
            lesson,
            type,
            undefined,
            reservation.reservedVersions?.[type],
          )
          .catch((renderError: unknown) => {
            // The failure names the item, for the admin and for the log.
            this.logger.error(
              `PDF do item ${type} da lição ${id} falhou na publicação: ${renderError instanceof Error ? (renderError.stack ?? renderError.message) : String(renderError)}`,
            );
            throw stagePdfUnavailable(type, renderError);
          });
        const fieldKey = `generated-${type.toLowerCase()}`;
        const fileName = lessonPdfFileName(lesson, `${type.toLowerCase()}-`);
        dto.documents.push({
          title: LESSON_PUBLICATION_TITLES[type],
          description: lesson.biblicalReference,
          uploadType: UploadType.UPLOAD,
          mediaType: MediaType.DOCUMENT,
          isLocalFile: true,
          fieldKey,
          originalName: fileName,
          size: pdfBuffer.length,
        });
        files[fieldKey] = {
          fieldname: fieldKey,
          originalname: fileName,
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
          buffer: pdfBuffer,
        } as Express.Multer.File;
      }
      // Fence: never create the page for a reservation we no longer own.
      const stillOwner =
        !leaseLost &&
        (await this.repo.renewPublicationLease(
          id,
          attemptToken,
          LESSON_PUBLICATION.LEASE_SECONDS,
        )) !== false;
      if (!stillOwner)
        throw new AppConflictException(
          ErrorCode.LESSON_PUBLICATION_IN_PROGRESS,
          'A publicação perdeu a reserva desta lição antes de criar o material. Tente novamente.',
        );
      const page = await this.weekMaterials.createWeekMaterialsPage(
        dto,
        files,
        { routePathSource: lessonPublicationRoutePathSource(lesson) },
      );
      createdPageId = page.id;
      await this.confirmPublication(
        id,
        attemptToken,
        page.id,
        reservation.reservedVersions ?? {},
        actorId,
      );
      this.support.audit(LessonWorkflowAction.PUBLISH, id, actorId, {
        weekMaterialId: page.id,
      });
      return {
        lesson: await this.lessons.getById(id),
        weekMaterialId: page.id,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Publicação da lição ${id} falhou: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
      const recoveredPageId = await this.settleFailedPublication(
        id,
        attemptToken,
        createdPageId,
        error,
        reservation.reservedVersions ?? {},
        actorId,
      );
      // The material exists and the lesson is linked: that is a success.
      if (recoveredPageId)
        return {
          lesson: await this.lessons.getById(id),
          weekMaterialId: recoveredPageId,
        };
      throw error;
    } finally {
      clearInterval(heartbeat);
      this.activePublications.delete(id);
    }
  }

  /**
   * Links the created page. The page is the source of truth (one per lesson by
   * unique index): once it exists the lesson is always linked and marked as
   * published, even when the reservation was lost meanwhile.
   */
  private async confirmPublication(
    id: string,
    attemptToken: string,
    weekMaterialId: string,
    reservedVersions: Record<string, string>,
    actorId?: string,
  ): Promise<void> {
    await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!locked) throw lessonNotFound();
      await this.linkExistingPage(
        locked,
        attemptToken,
        weekMaterialId,
        reservedVersions,
        manager,
        actorId,
      );
    });
  }

  /**
   * Marks the lesson as published by a page that exists. When the reservation
   * was overridden meanwhile (lease lost and an item reopened), the items that
   * still point to the published version go back to approved; an item whose
   * content changed keeps its status and is reported in the log.
   */
  private async linkExistingPage(
    locked: LessonEntity,
    attemptToken: string,
    weekMaterialId: string,
    reservedVersions: Record<string, string>,
    manager: EntityManager,
    actorId?: string,
  ): Promise<void> {
    const ownsReservation =
      locked.status === LessonStatus.PUBLISHING &&
      locked.publicationLeaseOwner === attemptToken;
    if (!ownsReservation)
      this.logger.warn(
        `Lição ${locked.id} vinculada ao material ${weekMaterialId} sem a posse da reserva (status ${locked.status}).`,
      );
    const restored: string[] = [];
    const diverged: string[] = [];
    for (const stage of locked.stages) {
      if (stage.status === LessonStageStatus.APPROVED) continue;
      const reserved = reservedVersions[stage.type];
      if (!reserved || stage.currentVersionId !== reserved) {
        diverged.push(`${stage.type}=${stage.status}`);
        continue;
      }
      stage.status = LessonStageStatus.APPROVED;
      stage.approvedAt = new Date();
      stage.approvedById = actorId ?? null;
      await this.repo.updateStage(
        stage.id,
        {
          status: LessonStageStatus.APPROVED,
          approvedAt: stage.approvedAt,
          approvedById: stage.approvedById,
        },
        manager,
      );
      restored.push(stage.type);
    }
    if (restored.length || diverged.length)
      this.logger.warn(
        `Lição ${locked.id} mudou durante a publicação do material ${weekMaterialId}: itens restaurados para aprovado [${restored.join(', ')}]; itens com conteúdo diferente do publicado [${diverged.join(', ')}].`,
      );
    await this.markPublished(locked, weekMaterialId, manager);
  }

  /** Returns the page id when the failed attempt still ended up published. */
  private async settleFailedPublication(
    id: string,
    attemptToken: string,
    createdPageId: string | null,
    error: unknown,
    reservedVersions: Record<string, string>,
    actorId?: string,
  ): Promise<string | null> {
    let recoveredPageId = createdPageId;
    if (!recoveredPageId) {
      try {
        recoveredPageId =
          (await this.findExistingWeekMaterialPage(id, true))?.id ?? null;
      } catch (lookupError: unknown) {
        // Unknown outcome: stay PUBLISHING; the lease expiry reconciles it.
        this.logger.error(
          `Não foi possível verificar o material da lição ${id} após a falha: ${String(lookupError)}`,
        );
        return null;
      }
    }
    try {
      return await this.repo.runInTransaction(async (manager) => {
        const locked = await this.repo.findLessonByIdForUpdate(id, manager);
        if (!locked) return null;
        if (recoveredPageId) {
          await this.linkExistingPage(
            locked,
            attemptToken,
            recoveredPageId,
            reservedVersions,
            manager,
            actorId,
          );
          return recoveredPageId;
        }
        if (
          locked.status === LessonStatus.PUBLISHING &&
          locked.publicationLeaseOwner === attemptToken &&
          !locked.weekMaterialId
        ) {
          await this.repo.updateLesson(
            locked.id,
            {
              status: LessonStatus.READY_FOR_PUBLICATION,
              publicationLeaseOwner: null,
              publicationLeaseUntil: null,
              publicationReservedVersionsJson: null,
              publicationFailureMessage: publicPublicationFailureMessage(error),
            },
            manager,
          );
        }
        return null;
      });
    } catch (settleError: unknown) {
      this.logger.error(
        `Falha ao atualizar status pós-erro de publicação: ${String(settleError)}`,
      );
      return null;
    }
  }

  async archive(id: string, actorId?: string): Promise<LessonEntity> {
    await this.transitionLessonStatus(
      id,
      LessonStatus.PUBLISHED,
      LessonStatus.ARCHIVED,
      'Somente uma lição publicada pode ser arquivada.',
    );
    this.support.audit(LessonWorkflowAction.ARCHIVE, id, actorId);
    return this.lessons.getById(id);
  }

  async unarchive(id: string, actorId?: string): Promise<LessonEntity> {
    await this.transitionLessonStatus(
      id,
      LessonStatus.ARCHIVED,
      LessonStatus.PUBLISHED,
      'Somente uma lição arquivada pode ser restaurada.',
    );
    this.support.audit(LessonWorkflowAction.UNARCHIVE, id, actorId);
    return this.lessons.getById(id);
  }

  private async transitionLessonStatus(
    id: string,
    from: LessonStatus,
    to: LessonStatus,
    invalidStateMessage: string,
  ): Promise<void> {
    await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!locked) throw lessonNotFound();
      if (locked.status !== from)
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          invalidStateMessage,
        );
      await this.repo.updateLesson(locked.id, { status: to }, manager);
    });
  }
}
