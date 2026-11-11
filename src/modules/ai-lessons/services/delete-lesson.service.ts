import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConflictException, ErrorCode } from 'src/shared/exceptions';
import { LessonStatus } from '../enums/lesson.enums';
import { LessonWorkflowAction } from '../enums/lesson-failure-code.enum';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { extractOwnedLessonVersionAssetUrls } from '../utils/lesson-asset-ownership.utils';
import { assertLessonMutable } from '../utils/lesson-workflow.utils';
import { LessonStudioSupportService } from './lesson-studio-support.service';
import { lessonNotFound } from '../utils/lesson-studio-errors.utils';

/** Deletes a lesson and, after the commit, the S3 objects only it owned. */
@Injectable()
export class DeleteLessonService {
  constructor(
    private readonly repo: AiLessonsRepository,
    private readonly config: ConfigService,
    private readonly support: LessonStudioSupportService,
  ) {}

  async delete(
    id: string,
    actorId?: string,
  ): Promise<{ success: boolean; message: string }> {
    let removableUrls: string[] = [];

    await this.repo.runInTransaction(async (manager) => {
      const lesson = await this.repo.findLessonById(id, manager, true);
      if (!lesson) throw lessonNotFound();
      assertLessonMutable(
        lesson,
        'Aguarde a geração ou publicação em andamento antes de excluir a lição.',
      );
      if (lesson.status === LessonStatus.PUBLISHED)
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'Uma lição publicada deve ser arquivada, não excluída.',
        );
      if (lesson.status === LessonStatus.ARCHIVED)
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'Uma lição arquivada preserva o histórico do material publicado e não pode ser excluída.',
        );

      const bucketName = this.config.get<string>('AWS_S3_BUCKET_NAME');
      const ownedUrls = new Set<string>();
      for (const stage of lesson.stages || []) {
        for (const version of stage.versions || []) {
          for (const url of extractOwnedLessonVersionAssetUrls(
            id,
            version,
            bucketName,
          )) {
            ownedUrls.add(url);
          }
        }
      }
      // Decided before the commit: a failure here keeps lesson and files.
      const referencedElsewhere =
        await this.repo.findAssetUrlsReferencedElsewhere(
          id,
          [...ownedUrls],
          manager,
        );
      removableUrls = [...ownedUrls].filter(
        (url) => !referencedElsewhere.has(url),
      );
      await this.repo.removeLesson(lesson, manager);
    });

    // The lesson is gone: from here on nothing may turn into an error response.
    await this.support.discardUploads(removableUrls, true);
    this.support.audit(LessonWorkflowAction.DELETE, id, actorId);

    return {
      success: true,
      message:
        'Lição e todos os seus itens associados foram excluídos com sucesso.',
    };
  }
}
