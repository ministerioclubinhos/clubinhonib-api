import { Injectable } from '@nestjs/common';
import { AppConflictException, ErrorCode } from 'src/shared/exceptions';
import {
  LESSON_CANONICAL_VERSE_VERSION,
  LESSON_STAGE_COMPLETED_STATUSES,
} from '../constants/lesson-workflow.constants';
import { LESSON_VERSE_CHANGE } from '../constants/lesson-verse-change.constants';
import { ChangeMemoryVerseRequestDto } from '../dto/change-memory-verse.dto';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import {
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
  LessonVersionSource,
} from '../enums/lesson.enums';
import { LessonWorkflowAction } from '../enums/lesson-failure-code.enum';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import { normalizeLessonVerseReference, unquoteLessonVerse } from '../utils';
import {
  isBibleReference,
  reconcileStageStructuredContent,
} from '../utils/lesson-canonical-content.utils';
import { lessonContentToTiptap } from '../utils/lesson-tiptap.utils';
import {
  currentMemoryVerse,
  isSameVerse,
  lessonVerseChangeSummary,
  replaceMemoryVerseInDocument,
  stagesOutdatedByVerseChange,
  type LessonVerseValue,
} from '../utils/lesson-verse-change.utils';
import {
  assertLessonMutable,
  lessonAsObject,
  lessonContentChecksum,
  lessonCurrentVersion,
} from '../utils/lesson-workflow.utils';
import {
  lessonNotFound,
  stageNotFound,
} from '../utils/lesson-studio-errors.utils';
import { GetLessonService } from './get-lesson.service';
import { LessonStudioSupportService } from './lesson-studio-support.service';

const TERMINAL_STATUSES: readonly LessonStatus[] = [
  LessonStatus.PUBLISHED,
  LessonStatus.ARCHIVED,
];

/**
 * Changes only the memory verse of a lesson. The verse lives in item 1 and
 * every later item that prints it is built from it, so the change writes a
 * new version of item 1, sends it back to production and marks every later
 * item as outdated: they must be generated again.
 */
@Injectable()
export class UpdateLessonVerseService {
  constructor(
    private readonly repo: AiLessonsRepository,
    private readonly support: LessonStudioSupportService,
    private readonly lessons: GetLessonService,
  ) {}

  async changeMemoryVerse(
    id: string,
    dto: ChangeMemoryVerseRequestDto,
    userId: string,
  ): Promise<LessonEntity> {
    const verse = this.normalizedVerse(dto);
    let versionId: string | undefined;
    await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!locked) throw lessonNotFound();
      const lesson = await this.repo.findLessonById(id, manager);
      if (!lesson) throw lessonNotFound();
      assertLessonMutable(
        lesson,
        'Aguarde a geração ou publicação em andamento antes de alterar o versículo.',
      );
      if (TERMINAL_STATUSES.includes(lesson.status))
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          LESSON_VERSE_CHANGE.TERMINAL_MESSAGE,
        );
      const stage = lesson.stages.find(
        (item) => item.type === LessonStageType.LESSON,
      );
      if (!stage) throw stageNotFound();
      if (stage.lockVersion !== dto.lockVersion)
        throw new AppConflictException(
          ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
          'Esta etapa foi alterada em outra sessão. Recarregue antes de alterar o versículo.',
        );
      const current = lessonCurrentVersion(stage);
      if (!current?.structuredDataJson)
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          LESSON_VERSE_CHANGE.NOT_GENERATED_MESSAGE,
        );
      const before = currentMemoryVerse(
        current.structuredDataJson as LessonJsonObject,
      );
      // The same verse is not a change: no version, nothing invalidated.
      if (isSameVerse(before, verse)) return;

      const affected = stagesOutdatedByVerseChange(lesson);
      const concluded = LESSON_STAGE_COMPLETED_STATUSES.includes(stage.status);
      if ((affected.length > 0 || concluded) && !dto.acknowledgeImpact)
        throw new AppConflictException(
          ErrorCode.LESSON_VERSE_CHANGE_NOT_ACKNOWLEDGED,
          LESSON_VERSE_CHANGE.NOT_ACKNOWLEDGED_MESSAGE,
        );

      const { structured, document } = this.rewrite(
        lesson,
        stage,
        current.structuredDataJson as LessonJsonObject,
        current.tiptapAstJson as LessonJsonObject | null,
        verse,
      );
      const nextVersion =
        Math.max(0, ...stage.versions.map((version) => version.versionNumber)) +
        1;
      const saved = await this.repo.saveVersion(
        this.repo.createVersion({
          stage: { id: stage.id } as LessonStageEntity,
          stageId: stage.id,
          versionNumber: nextVersion,
          tiptapAstJson: document,
          structuredDataJson: structured,
          docxS3Key: null,
          pdfS3Key: null,
          changeSummary: lessonVerseChangeSummary(before, verse),
          createdSource: LessonVersionSource.MANUAL_EDIT,
          createdById: userId,
          openAiResponseId: null,
          adminPromptSnapshot: null,
          adminPromptChecksum: null,
          contentChecksum: lessonContentChecksum(structured),
        }),
        manager,
      );
      versionId = saved.id;
      const previousStatus = stage.status;
      stage.currentVersionId = saved.id;
      stage.status = LessonStageStatus.DRAFT;
      await this.repo.updateStage(
        stage.id,
        {
          currentVersionId: saved.id,
          status: LessonStageStatus.DRAFT,
          failureCode: null,
          failureMessage: null,
        },
        manager,
      );
      // Forced: a review cycle never protects the items that print the verse.
      await this.support.invalidateDownstream(
        lesson,
        LessonStageType.LESSON,
        manager,
        previousStatus,
        true,
      );
    });
    if (versionId)
      this.support.audit(LessonWorkflowAction.CHANGE_VERSE, id, userId, {
        stage: LessonStageType.LESSON,
        versionId,
      });
    return this.lessons.getById(id);
  }

  /** The verse as it is stored: reference without version, text without quotation marks, always NVI. */
  private normalizedVerse(dto: ChangeMemoryVerseRequestDto): LessonVerseValue {
    const reference = normalizeLessonVerseReference(dto.reference);
    if (!isBibleReference(reference))
      throw new AppConflictException(
        ErrorCode.LESSON_INVALID_REQUEST,
        LESSON_VERSE_CHANGE.INVALID_REFERENCE_MESSAGE,
      );
    return {
      text: unquoteLessonVerse(dto.text).replace(/\s+/g, ' '),
      reference,
      version: LESSON_CANONICAL_VERSE_VERSION,
    };
  }

  /**
   * New structured content and document. The document keeps the admin's edits
   * and formatting; it is rebuilt from the structured content only when it
   * has no verse section to patch.
   */
  private rewrite(
    lesson: LessonEntity,
    stage: LessonStageEntity,
    structured: LessonJsonObject,
    document: LessonJsonObject | null,
    verse: LessonVerseValue,
  ): { structured: LessonJsonObject; document: LessonJsonObject } {
    const next: LessonJsonObject = {
      ...structured,
      memoryVerse: { ...lessonAsObject(structured.memoryVerse), ...verse },
    };
    const patched = document
      ? replaceMemoryVerseInDocument(document, verse)
      : null;
    if (patched) {
      const reconciled = reconcileStageStructuredContent(
        stage.type,
        structured,
        next,
        patched,
      );
      return {
        // The verse is exactly what the admin typed, whatever the parser read.
        structured: { ...reconciled, memoryVerse: next.memoryVerse },
        document: patched,
      };
    }
    return {
      structured: next,
      document: lessonContentToTiptap(
        next,
        lesson.weekNumber,
        stage.type,
        lesson.category,
      ),
    };
  }
}
