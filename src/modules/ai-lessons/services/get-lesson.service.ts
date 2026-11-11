import { Injectable } from '@nestjs/common';
import { QueryLessonsDto } from '../dto/query-lessons.dto';
import { LessonEntity } from '../entities/lesson.entity';
import {
  getLessonStageOrder,
  LessonStageType,
  LessonStatus,
} from '../enums/lesson.enums';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import type { LessonDraftPage } from '../types/lesson-generation.types';
import { normalizeLessonDocumentHeader } from '../utils';
import { lessonEventDigest } from '../utils/lesson-event-digest.utils';
import { lessonNotFound } from '../utils/lesson-studio-errors.utils';

/** Read operations of the studio. Reads are pure: they never create stages, update templates or revoke approvals. */
@Injectable()
export class GetLessonService {
  constructor(private readonly repo: AiLessonsRepository) {}

  async getDrafts(
    query: QueryLessonsDto,
  ): Promise<LessonDraftPage<LessonEntity>> {
    const { items, total } = await this.repo.findDraftsPaginated(query);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getDashboard(): Promise<{
    total: number;
    byStatus: Record<LessonStatus, number>;
    recent: LessonEntity[];
  }> {
    const rows = await this.repo.getDashboardStatusCounts();
    const byStatus = Object.fromEntries(
      Object.values(LessonStatus).map((status) => [status, 0]),
    ) as Record<LessonStatus, number>;
    rows.forEach((row) => {
      byStatus[row.status] = Number(row.count);
    });
    const recent = await this.repo.findRecentLessons(5);
    return {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      byStatus,
      recent,
    };
  }

  async getById(id: string): Promise<LessonEntity> {
    const lesson = await this.repo.findLessonById(id);
    if (!lesson) throw lessonNotFound();
    const stageOrder = getLessonStageOrder(lesson.category);
    lesson.stages.sort(
      (a, b) => stageOrder.indexOf(a.type) - stageOrder.indexOf(b.type),
    );
    for (const stage of lesson.stages) {
      stage.versions?.sort((a, b) => a.versionNumber - b.versionNumber);
      if (stage.type === LessonStageType.LESSON)
        for (const version of stage.versions ?? [])
          if (version.tiptapAstJson)
            version.tiptapAstJson = normalizeLessonDocumentHeader(
              version.tiptapAstJson,
              lesson.weekNumber,
              lesson.category,
            );
    }
    return lesson;
  }

  /** Cheap fingerprint of what the studio renders; never loads versions. */
  async getEventDigest(id: string): Promise<string> {
    const source = await this.repo.findLessonDigestSource(id);
    if (!source) throw lessonNotFound();
    return lessonEventDigest(source);
  }
}
