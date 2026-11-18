import { Inject, Injectable } from '@nestjs/common';
import { AppConflictException, ErrorCode } from 'src/shared/exceptions';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageType, LessonStatus } from '../enums/lesson.enums';
import { LessonWorkflowAction } from '../enums/lesson-failure-code.enum';
import { LESSON_LLM_PROVIDER } from '../providers/lesson-llm.constants';
import { LessonLlmProviderContract } from '../providers/lesson-llm.types';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import {
  assertLessonMutable,
  lessonCurrentContent,
} from '../utils/lesson-workflow.utils';
import {
  lessonNotFound,
  stageNotFound,
} from '../utils/lesson-studio-errors.utils';
import { GenerateLessonCoverService } from './generate-lesson-cover.service';
import { GetLessonService } from './get-lesson.service';
import { LessonStudioSupportService } from './lesson-studio-support.service';

const COVER_LOCKED_STATUSES: readonly LessonStatus[] = [
  LessonStatus.PUBLISHED,
  LessonStatus.ARCHIVED,
];

/** Draws the presentation image of a lesson again, without touching any item. */
@Injectable()
export class UpdateLessonCoverService {
  constructor(
    private readonly repo: AiLessonsRepository,
    @Inject(LESSON_LLM_PROVIDER)
    private readonly llm: LessonLlmProviderContract,
    private readonly lessons: GetLessonService,
    private readonly support: LessonStudioSupportService,
    private readonly covers: GenerateLessonCoverService,
  ) {}

  async regenerate(id: string, actorId?: string): Promise<LessonEntity> {
    const lesson = await this.lessons.getById(id);
    this.assertCanChange(lesson);
    const stage = lesson.stages.find(
      (item) => item.type === LessonStageType.LESSON,
    );
    if (!stage) throw stageNotFound();
    const content = lessonCurrentContent(stage);
    if (!content)
      throw new AppConflictException(
        ErrorCode.LESSON_INVALID_STATE,
        'Gere a lição completa (item 1) antes de criar a imagem de apresentação.',
      );

    const provider = this.llm.createAttemptProvider
      ? (await this.llm.createAttemptProvider()).provider
      : this.llm;
    const url = await this.covers.generate({
      lessonId: id,
      lesson,
      content,
      llmProvider: provider,
    });

    let replaced: string | null = null;
    try {
      await this.repo.runInTransaction(async (manager) => {
        const locked = await this.repo.findLessonByIdForUpdate(id, manager);
        if (!locked) throw lessonNotFound();
        // The lesson may have moved on while the image was being drawn.
        this.assertCanChange(locked);
        const lockedStage = locked.stages.find(
          (item) => item.type === LessonStageType.LESSON,
        );
        if (lockedStage?.currentVersionId !== stage.currentVersionId)
          throw new AppConflictException(
            ErrorCode.LESSON_INVALID_STATE,
            'A lição completa mudou enquanto a imagem era gerada. Tente novamente.',
          );
        replaced = locked.coverImageUrl;
        await this.repo.updateLesson(id, { coverImageUrl: url }, manager);
      });
    } catch (error: unknown) {
      // Nothing links the new image: it would be an orphan in the bucket.
      await this.support.discardUploads([url]);
      throw error;
    }
    if (replaced && replaced !== url)
      await this.support.discardUploads([replaced]);
    this.support.audit(LessonWorkflowAction.REGENERATE_COVER, id, actorId);
    return this.lessons.getById(id);
  }

  /** The route of a published material already shows its image: only a draft can change it. */
  private assertCanChange(
    lesson: Pick<LessonEntity, 'status' | 'stages'>,
  ): void {
    assertLessonMutable(
      lesson,
      'Aguarde a geração ou a publicação em andamento antes de gerar a imagem de apresentação.',
    );
    if (COVER_LOCKED_STATUSES.includes(lesson.status))
      throw new AppConflictException(
        ErrorCode.LESSON_INVALID_STATE,
        'A imagem de apresentação de uma lição publicada ou arquivada não pode ser alterada.',
      );
  }
}
