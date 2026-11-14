import { Injectable } from '@nestjs/common';
import { WeekMaterialsPageGetService } from 'src/modules/pages/week-material-page/services/get-week-material.service';
import { AppNotFoundException } from 'src/shared/exceptions';
import { getLessonStageOrder, LessonCategory } from '../enums/lesson.enums';
import type {
  LessonPublicationMaterial,
  LessonPublicationPreview,
} from '../types/lesson-generation.types';
import { lessonPublicationTitle } from '../utils/lesson-workflow.utils';
import { GetLessonService } from './get-lesson.service';

/** Read side of the publication: what publishing will create and what already exists. */
@Injectable()
export class GetLessonPublicationService {
  constructor(
    private readonly lessons: GetLessonService,
    private readonly weekMaterialsGet: WeekMaterialsPageGetService,
  ) {}

  /**
   * Title and number of PDFs of the page the publication creates, the state
   * of the page already linked to the lesson, and the existing materials that
   * look like the same thing. Informative: a duplicate never blocks.
   */
  async preview(id: string): Promise<LessonPublicationPreview> {
    const lesson = await this.lessons.getById(id);
    const isSpecial = lesson.category === LessonCategory.SPECIAL;
    const title = lessonPublicationTitle(lesson);
    const weekMaterial = lesson.weekMaterialId
      ? await this.linkedMaterial(lesson.weekMaterialId)
      : null;
    const duplicates = await this.weekMaterialsGet.findPossibleDuplicates({
      title,
      weekNumber: lesson.weekNumber,
      special: isSpecial,
      excludePageId: lesson.weekMaterialId,
    });
    return {
      title,
      isSpecial,
      documentCount: getLessonStageOrder(lesson.category).length,
      weekMaterial,
      duplicates,
    };
  }

  /** Only "not found" means the page is gone; other lookup errors propagate. */
  private async linkedMaterial(
    weekMaterialId: string,
  ): Promise<LessonPublicationMaterial> {
    try {
      const page = await this.weekMaterialsGet.findOnePage(weekMaterialId);
      return {
        id: weekMaterialId,
        exists: true,
        routePath: page.route?.path ?? null,
        currentWeek: Boolean(page.currentWeek),
      };
    } catch (error: unknown) {
      if (!(error instanceof AppNotFoundException)) throw error;
      return {
        id: weekMaterialId,
        exists: false,
        routePath: null,
        currentWeek: false,
      };
    }
  }
}
