import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { LessonCommentEntity } from '../entities/lesson-comment.entity';
import { LessonStageStatus, LessonStatus } from '../enums/lesson.enums';
import { QueryLessonsDto, LessonSortField } from '../dto/query-lessons.dto';

const LESSON_SORT_COLUMNS: Record<LessonSortField, string> = {
  [LessonSortField.CREATED_AT]: 'lesson.createdAt',
  [LessonSortField.UPDATED_AT]: 'lesson.updatedAt',
  [LessonSortField.THEME]: 'lesson.theme',
  [LessonSortField.WEEK_NUMBER]: 'lesson.weekNumber',
};

@Injectable()
export class AiLessonsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LessonEntity)
    private readonly lessonsRepo: Repository<LessonEntity>,
    @InjectRepository(LessonStageEntity)
    private readonly stagesRepo: Repository<LessonStageEntity>,
    @InjectRepository(LessonVersionEntity)
    private readonly versionsRepo: Repository<LessonVersionEntity>,
    @InjectRepository(LessonCommentEntity)
    private readonly commentsRepo: Repository<LessonCommentEntity>,
  ) {}

  async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  private lessons(manager?: EntityManager): Repository<LessonEntity> {
    return manager ? manager.getRepository(LessonEntity) : this.lessonsRepo;
  }

  private stages(manager?: EntityManager): Repository<LessonStageEntity> {
    return manager ? manager.getRepository(LessonStageEntity) : this.stagesRepo;
  }

  private versions(manager?: EntityManager): Repository<LessonVersionEntity> {
    return manager
      ? manager.getRepository(LessonVersionEntity)
      : this.versionsRepo;
  }

  private comments(manager?: EntityManager): Repository<LessonCommentEntity> {
    return manager
      ? manager.getRepository(LessonCommentEntity)
      : this.commentsRepo;
  }

  private bindStageToVersions(stage: LessonStageEntity): void {
    if (stage && Array.isArray(stage.versions)) {
      for (const version of stage.versions) {
        if (!version.stage) {
          version.stage = stage;
        }
        if (!version.stageId && stage.id) {
          version.stageId = stage.id;
        }
      }
    }
  }

  createLesson(data: Partial<LessonEntity>): LessonEntity {
    return this.lessonsRepo.create(data);
  }

  async saveLesson(
    lesson: LessonEntity,
    manager?: EntityManager,
  ): Promise<LessonEntity> {
    if (lesson && Array.isArray(lesson.stages)) {
      lesson.stages.forEach((stage) => this.bindStageToVersions(stage));
    }
    return this.lessons(manager).save(lesson);
  }

  async updateLesson(
    lessonId: string,
    data: QueryDeepPartialEntity<LessonEntity>,
    manager?: EntityManager,
  ): Promise<void> {
    await this.lessons(manager).update(lessonId, data);
  }

  async findLessonByIdForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<LessonEntity | null> {
    return this.lessons(manager)
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.stages', 'stages')
      .setLock('pessimistic_write')
      .where('lesson.id = :id', { id })
      .getOne();
  }

  async findLessonById(
    id: string,
    manager?: EntityManager,
    forUpdate = false,
  ): Promise<LessonEntity | null> {
    return this.lessons(manager).findOne({
      where: { id },
      relations: ['stages', 'stages.versions', 'comments'],
      lock: forUpdate ? { mode: 'pessimistic_write' } : undefined,
    });
  }

  async findDraftsPaginated(
    params: QueryLessonsDto,
  ): Promise<{ items: LessonEntity[]; total: number }> {
    const { status, statuses, category, search, page, limit, sort, order } =
      params;

    const query = this.lessonsRepo
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.stages', 'stages')
      .orderBy(LESSON_SORT_COLUMNS[sort], order)
      .addOrderBy('lesson.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (statuses && statuses.length > 0) {
      query.andWhere('lesson.status IN (:...statuses)', { statuses });
    } else if (status) {
      query.andWhere('lesson.status = :status', { status });
    }
    if (category) {
      query.andWhere('lesson.category = :category', { category });
    }
    if (search?.trim()) {
      query.andWhere(
        '(LOWER(lesson.theme) LIKE LOWER(:search) OR LOWER(lesson.biblicalReference) LIKE LOWER(:search))',
        { search: `%${search.trim()}%` },
      );
    }

    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  async getDashboardStatusCounts(): Promise<
    Array<{ status: LessonStatus; count: string }>
  > {
    return this.lessonsRepo
      .createQueryBuilder('lesson')
      .select('lesson.status', 'status')
      .addSelect('COUNT(lesson.id)', 'count')
      .groupBy('lesson.status')
      .getRawMany<{ status: LessonStatus; count: string }>();
  }

  async findRecentLessons(limit = 5): Promise<LessonEntity[]> {
    return this.lessonsRepo
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.stages', 'stages')
      .orderBy('lesson.updatedAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async removeLesson(
    lesson: LessonEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.lessons(manager).remove(lesson);
  }

  createStage(data: Partial<LessonStageEntity>): LessonStageEntity {
    return this.stagesRepo.create(data);
  }

  async saveStage(
    stage: LessonStageEntity,
    manager?: EntityManager,
  ): Promise<LessonStageEntity> {
    this.bindStageToVersions(stage);
    return this.stages(manager).save(stage);
  }

  async updateStage(
    stageId: string,
    data: QueryDeepPartialEntity<LessonStageEntity>,
    manager?: EntityManager,
  ): Promise<void> {
    await this.stages(manager).update(stageId, data);
  }

  async saveStages(
    stages: LessonStageEntity[],
    manager?: EntityManager,
  ): Promise<LessonStageEntity[]> {
    stages.forEach((stage) => this.bindStageToVersions(stage));
    return this.stages(manager).save(stages);
  }

  async findGeneratingStages(): Promise<LessonStageEntity[]> {
    return this.stagesRepo.find({
      where: { status: LessonStageStatus.GENERATING },
    });
  }

  async claimGeneration(
    stageId: string,
    owner: string,
    leaseUntil: Date,
  ): Promise<boolean> {
    const result = await this.stagesRepo
      .createQueryBuilder()
      .update(LessonStageEntity)
      .set({ generationLeaseOwner: owner, generationLeaseUntil: leaseUntil })
      .where('id = :stageId', { stageId })
      .andWhere('status = :status', { status: LessonStageStatus.GENERATING })
      .andWhere(
        '(generation_lease_until IS NULL OR generation_lease_until < CURRENT_TIMESTAMP)',
      )
      .execute();
    return result.affected === 1;
  }

  async renewGenerationLease(
    stageId: string,
    owner: string,
    leaseUntil: Date,
  ): Promise<boolean> {
    const result = await this.stagesRepo.update(
      {
        id: stageId,
        generationLeaseOwner: owner,
        status: LessonStageStatus.GENERATING,
      },
      { generationLeaseUntil: leaseUntil },
    );
    return (result.affected ?? 0) === 1;
  }

  async findPublishingLessons(): Promise<LessonEntity[]> {
    return this.lessonsRepo.find({
      where: { status: LessonStatus.PUBLISHING },
      relations: ['stages'],
    });
  }

  async claimPublication(
    lessonId: string,
    owner: string,
    leaseUntil: Date,
  ): Promise<boolean> {
    const result = await this.lessonsRepo
      .createQueryBuilder()
      .update(LessonEntity)
      .set({ publicationLeaseOwner: owner, publicationLeaseUntil: leaseUntil })
      .where('id = :lessonId', { lessonId })
      .andWhere('status = :status', { status: LessonStatus.PUBLISHING })
      .andWhere(
        '(publication_lease_until IS NULL OR publication_lease_until < CURRENT_TIMESTAMP)',
      )
      .execute();
    return result.affected === 1;
  }

  async renewPublicationLease(
    lessonId: string,
    owner: string,
    leaseUntil: Date,
  ): Promise<boolean> {
    const result = await this.lessonsRepo.update(
      {
        id: lessonId,
        publicationLeaseOwner: owner,
        status: LessonStatus.PUBLISHING,
      },
      { publicationLeaseUntil: leaseUntil },
    );
    return (result.affected ?? 0) === 1;
  }

  async isAssetReferencedElsewhere(
    lessonId: string,
    assetUrl: string,
  ): Promise<boolean> {
    const trimmed = assetUrl.trim();
    if (!trimmed) return false;
    let keySearch = trimmed;
    try {
      const parsed = new URL(trimmed);
      const cleanPath = decodeURIComponent(
        parsed.pathname.replace(/^\/+/, ''),
      ).trim();
      if (cleanPath) {
        keySearch = cleanPath.split('/').pop() ?? cleanPath;
      }
    } catch {
      keySearch = trimmed;
    }

    const otherVersionRows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT lv.id
       FROM lesson_versions lv
       INNER JOIN lesson_stages ls ON ls.id = lv.stage_id
       WHERE ls.lesson_id <> ?
         AND (
           lv.docx_s3_key = ?
           OR lv.pdf_s3_key = ?
           OR CAST(lv.structured_data_json AS CHAR) LIKE ?
         )
       LIMIT 1`,
      [lessonId, trimmed, trimmed, `%${keySearch}%`],
    );
    if (otherVersionRows.length > 0) return true;

    const mediaRows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM media_items WHERE url = ? OR url LIKE ? LIMIT 1`,
      [trimmed, `%${keySearch}%`],
    );
    return mediaRows.length > 0;
  }

  createVersion(data: Partial<LessonVersionEntity>): LessonVersionEntity {
    return this.versionsRepo.create(data);
  }

  async saveVersion(
    version: LessonVersionEntity,
    manager?: EntityManager,
  ): Promise<LessonVersionEntity> {
    return this.versions(manager).save(version);
  }

  createComment(data: Partial<LessonCommentEntity>): LessonCommentEntity {
    return this.commentsRepo.create(data);
  }

  async saveComment(
    comment: LessonCommentEntity,
    manager?: EntityManager,
  ): Promise<LessonCommentEntity> {
    return this.comments(manager).save(comment);
  }
}
