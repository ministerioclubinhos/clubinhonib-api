import { Injectable } from '@nestjs/common';
import { AppConflictException, ErrorCode } from 'src/shared/exceptions';
import { LESSON_STAGE_EDITABLE_STATUSES } from '../constants/lesson-workflow.constants';
import { SaveTiptapContentDto } from '../dto/save-tiptap-content.dto';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import {
  LessonStageStatus,
  LessonStageType,
  LessonVersionSource,
} from '../enums/lesson.enums';
import { LessonWorkflowAction } from '../enums/lesson-failure-code.enum';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import { normalizeLessonDocumentHeader } from '../utils';
import { reconcileStageStructuredContent } from '../utils/lesson-canonical-content.utils';
import {
  assertLessonMutable,
  lessonContentChecksum,
  lessonCurrentVersion,
  lessonStableStringify,
} from '../utils/lesson-workflow.utils';
import { GetLessonService } from './get-lesson.service';
import { LessonStudioSupportService } from './lesson-studio-support.service';
import {
  lessonNotFound,
  stageNotFound,
} from '../utils/lesson-studio-errors.utils';

/** Manual edition of a stage: reconciles the edited document with the canonical data and versions it. */
@Injectable()
export class UpdateLessonContentService {
  constructor(
    private readonly repo: AiLessonsRepository,
    private readonly support: LessonStudioSupportService,
    private readonly lessons: GetLessonService,
  ) {}

  async saveContent(
    id: string,
    dto: SaveTiptapContentDto,
    userId: string,
  ): Promise<LessonEntity> {
    let savedVersionId: string | undefined;
    await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!locked) throw lessonNotFound();
      const lesson = await this.repo.findLessonById(id, manager);
      if (!lesson) throw lessonNotFound();
      assertLessonMutable(
        lesson,
        'Aguarde a geração ou publicação em andamento antes de editar a lição.',
      );
      const stage = lesson.stages.find((item) => item.type === dto.stage);
      if (!stage) throw stageNotFound();
      if (stage.lockVersion !== dto.lockVersion)
        throw new AppConflictException(
          ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
          'Esta etapa foi alterada em outra sessão. Recarregue antes de salvar.',
        );
      if (!LESSON_STAGE_EDITABLE_STATUSES.includes(stage.status))
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'A etapa não está editável durante a revisão final.',
        );
      const current = lessonCurrentVersion(stage);
      const structured = reconcileStageStructuredContent(
        dto.stage,
        current?.structuredDataJson ?? null,
        dto.structuredDataJson,
        dto.tiptapAstJson,
      );
      // Saving what is already saved is not a change: no version is created
      // and nothing downstream is invalidated.
      if (
        current &&
        this.isSameContent(lesson, stage, current, structured, dto)
      )
        return;
      const nextVersion =
        Math.max(0, ...stage.versions.map((version) => version.versionNumber)) +
        1;
      const entity = this.repo.createVersion({
        stage: { id: stage.id } as LessonStageEntity,
        stageId: stage.id,
        versionNumber: nextVersion,
        tiptapAstJson: dto.tiptapAstJson,
        structuredDataJson: structured,
        docxS3Key: null,
        pdfS3Key: null,
        changeSummary: dto.changeSummary ?? 'Edição manual',
        createdSource: LessonVersionSource.MANUAL_EDIT,
        createdById: userId,
        openAiResponseId: null,
        adminPromptSnapshot: null,
        adminPromptChecksum: null,
        contentChecksum: lessonContentChecksum(structured),
      });
      const version = await this.repo.saveVersion(entity, manager);
      savedVersionId = version.id;
      const previousStatus = stage.status;
      stage.currentVersionId = version.id;
      stage.status = LessonStageStatus.DRAFT;
      await this.repo.updateStage(
        stage.id,
        {
          currentVersionId: version.id,
          status: LessonStageStatus.DRAFT,
          failureCode: null,
          failureMessage: null,
        },
        manager,
      );
      await this.support.invalidateDownstream(
        lesson,
        dto.stage,
        manager,
        previousStatus,
      );
    });
    if (savedVersionId)
      this.support.audit(LessonWorkflowAction.SAVE_CONTENT, id, userId, {
        stage: dto.stage,
        versionId: savedVersionId,
      });
    return this.lessons.getById(id);
  }

  private isSameContent(
    lesson: LessonEntity,
    stage: LessonStageEntity,
    current: LessonVersionEntity,
    structured: LessonJsonObject,
    dto: SaveTiptapContentDto,
  ): boolean {
    if (
      lessonStableStringify(structured) !==
      lessonStableStringify(current.structuredDataJson ?? {})
    )
      return false;
    const incoming = lessonStableStringify(dto.tiptapAstJson);
    if (incoming === lessonStableStringify(current.tiptapAstJson)) return true;
    // The detail endpoint serves the lesson document with a normalized header.
    return (
      stage.type === LessonStageType.LESSON &&
      incoming ===
        lessonStableStringify(
          normalizeLessonDocumentHeader(
            current.tiptapAstJson,
            lesson.weekNumber,
            lesson.category,
          ),
        )
    );
  }
}
