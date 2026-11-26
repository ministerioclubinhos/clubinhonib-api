import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { LessonCommentEntity } from '../entities/lesson-comment.entity';
import { LessonStageStatus, LessonStatus } from '../enums/lesson.enums';
import { QueryLessonsDto } from '../dto/query-lessons.dto';
import {
  LESSON_ASSET_REFERENCE_BATCH_SIZE,
  LESSON_SORT_COLUMNS,
} from '../constants/lesson-repository.constants';
import type {
  LessonEventDigestSource,
  LessonGenerationRequest,
} from '../types/lesson-generation.types';
import { escapeLikePattern } from '../utils/lesson-workflow.utils';

/** `DATE_ADD` on the database clock: leases never depend on the app clock. */
function leaseExpiry(seconds: number): string {
  const safeSeconds = Math.max(1, Math.floor(Number(seconds) || 0));
  return `DATE_ADD(NOW(), INTERVAL ${safeSeconds} SECOND)`;
}

/** Last path segment of an asset URL: what uniquely names the object. */
function assetBaseName(url: string): string {
  const trimmed = url.trim();
  try {
    const path = decodeURIComponent(new URL(trimmed).pathname).replace(
      /^\/+/,
      '',
    );
    return path.split('/').pop() || trimmed;
  } catch {
    return trimmed.split('/').pop() || trimmed;
  }
}

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
    const {
      status,
      statuses,
      category,
      weekNumber,
      search,
      page,
      limit,
      sort,
      order,
    } = params;

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
    if (weekNumber !== undefined) {
      query.andWhere('lesson.weekNumber = :weekNumber', { weekNumber });
    }
    if (search?.trim()) {
      query.andWhere(
        "(LOWER(lesson.theme) LIKE LOWER(:search) ESCAPE '\\\\' OR LOWER(lesson.biblicalReference) LIKE LOWER(:search) ESCAPE '\\\\')",
        { search: `%${escapeLikePattern(search.trim())}%` },
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

  /** Lessons still in the works, most recently touched first. */
  async findLessonsOutsideStatuses(
    excluded: readonly LessonStatus[],
    limit: number,
  ): Promise<LessonEntity[]> {
    return this.lessonsRepo
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.stages', 'stages')
      .where('lesson.status NOT IN (:...excluded)', { excluded })
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

  /**
   * Atomically takes an unowned or expired generation lease. Lease writes keep
   * `lock_version` untouched: they are not content changes and must neither
   * invalidate an open editor nor break the event-stream deduplication.
   */
  async claimGeneration(
    stageId: string,
    owner: string,
    leaseSeconds: number,
  ): Promise<boolean> {
    const result = await this.stagesRepo
      .createQueryBuilder()
      .update(LessonStageEntity)
      .set({
        generationLeaseOwner: owner,
        generationLeaseUntil: () => leaseExpiry(leaseSeconds),
        lockVersion: () => 'lock_version',
      })
      .where('id = :stageId', { stageId })
      .andWhere('status = :status', { status: LessonStageStatus.GENERATING })
      .andWhere(
        '(generation_lease_until IS NULL OR generation_lease_until < NOW())',
      )
      .execute();
    return result.affected === 1;
  }

  async renewGenerationLease(
    stageId: string,
    owner: string,
    leaseSeconds: number,
  ): Promise<boolean> {
    const result = await this.stagesRepo
      .createQueryBuilder()
      .update(LessonStageEntity)
      .set({
        generationLeaseUntil: () => leaseExpiry(leaseSeconds),
        lockVersion: () => 'lock_version',
      })
      .where('id = :stageId', { stageId })
      .andWhere('generation_lease_owner = :owner', { owner })
      .andWhere('status = :status', { status: LessonStageStatus.GENERATING })
      .execute();
    return result.affected === 1;
  }

  /** Hands an owned lease back so another attempt can claim it at once. */
  async releaseGenerationLease(
    stageId: string,
    owner: string,
  ): Promise<boolean> {
    const result = await this.stagesRepo
      .createQueryBuilder()
      .update(LessonStageEntity)
      .set({
        generationLeaseOwner: null,
        generationLeaseUntil: null,
        lockVersion: () => 'lock_version',
      })
      .where('id = :stageId', { stageId })
      .andWhere('generation_lease_owner = :owner', { owner })
      .andWhere('status = :status', { status: LessonStageStatus.GENERATING })
      .execute();
    return result.affected === 1;
  }

  /** Persists attempt bookkeeping (counter, checkpoints) while owning the lease. */
  async updateGenerationRequest(
    stageId: string,
    owner: string,
    request: LessonGenerationRequest,
  ): Promise<boolean> {
    const result = await this.stagesRepo
      .createQueryBuilder()
      .update(LessonStageEntity)
      .set({
        generationRequestJson: request,
        lockVersion: () => 'lock_version',
      } as QueryDeepPartialEntity<LessonStageEntity>)
      .where('id = :stageId', { stageId })
      .andWhere('generation_lease_owner = :owner', { owner })
      .andWhere('status = :status', { status: LessonStageStatus.GENERATING })
      .execute();
    return result.affected === 1;
  }

  /** Publications whose lease is absent or expired on the database clock. */
  async findExpiredPublishingLessons(): Promise<LessonEntity[]> {
    return this.lessonsRepo
      .createQueryBuilder('lesson')
      .where('lesson.status = :status', { status: LessonStatus.PUBLISHING })
      .andWhere(
        '(lesson.publicationLeaseUntil IS NULL OR lesson.publicationLeaseUntil < NOW())',
      )
      .getMany();
  }

  async isPublicationLeaseActive(
    lessonId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await this.lessons(manager)
      .createQueryBuilder('lesson')
      .where('lesson.id = :lessonId', { lessonId })
      .andWhere('lesson.publicationLeaseUntil > NOW()')
      .getCount();
    return count > 0;
  }

  /** Marks the lesson as publishing under a lease owned by one attempt. */
  async reservePublication(
    lessonId: string,
    owner: string,
    leaseSeconds: number,
    reservedVersions: Record<string, string>,
    manager: EntityManager,
  ): Promise<void> {
    await this.lessons(manager)
      .createQueryBuilder()
      .update(LessonEntity)
      .set({
        status: LessonStatus.PUBLISHING,
        publicationLeaseOwner: owner,
        publicationLeaseUntil: () => leaseExpiry(leaseSeconds),
        publicationReservedVersionsJson: reservedVersions,
        publicationFailureMessage: null,
      })
      .where('id = :lessonId', { lessonId })
      .execute();
  }

  async renewPublicationLease(
    lessonId: string,
    owner: string,
    leaseSeconds: number,
  ): Promise<boolean> {
    const result = await this.lessonsRepo
      .createQueryBuilder()
      .update(LessonEntity)
      .set({ publicationLeaseUntil: () => leaseExpiry(leaseSeconds) })
      .where('id = :lessonId', { lessonId })
      .andWhere('publication_lease_owner = :owner', { owner })
      .andWhere('status = :status', { status: LessonStatus.PUBLISHING })
      .execute();
    return result.affected === 1;
  }

  /**
   * Which of the given asset URLs are also referenced by versions of OTHER
   * lessons. One aggregate query per batch instead of one table scan per URL.
   */
  async findAssetUrlsReferencedElsewhere(
    lessonId: string,
    assetUrls: readonly string[],
    manager?: EntityManager,
  ): Promise<Set<string>> {
    const urls = [
      ...new Set(assetUrls.map((url) => url.trim()).filter(Boolean)),
    ];
    const referenced = new Set<string>();
    for (
      let offset = 0;
      offset < urls.length;
      offset += LESSON_ASSET_REFERENCE_BATCH_SIZE
    ) {
      const batch = urls.slice(
        offset,
        offset + LESSON_ASSET_REFERENCE_BATCH_SIZE,
      );
      const query = this.versions(manager)
        .createQueryBuilder('version')
        .innerJoin('version.stage', 'stage')
        .select('COUNT(version.id)', 'scanned')
        .where('stage.lessonId <> :lessonId', { lessonId });
      batch.forEach((url, index) => {
        query
          .addSelect(
            `MAX(CASE WHEN version.docxS3Key = :url${index} OR version.pdfS3Key = :url${index} OR CAST(version.structuredDataJson AS CHAR) LIKE :pattern${index} ESCAPE '\\\\' THEN 1 ELSE 0 END)`,
            `match_${index}`,
          )
          .setParameter(`url${index}`, url)
          .setParameter(
            `pattern${index}`,
            `%${escapeLikePattern(assetBaseName(url))}%`,
          );
      });
      const row =
        await query.getRawOne<Record<string, string | number | null>>();
      batch.forEach((url, index) => {
        if (Number(row?.[`match_${index}`] ?? 0) > 0) referenced.add(url);
      });
    }
    return referenced;
  }

  async findLessonHeader(id: string): Promise<LessonEntity | null> {
    return this.lessonsRepo.findOne({ where: { id } });
  }

  /** Columns behind the event-stream digest; never loads versions. */
  async findLessonDigestSource(
    id: string,
  ): Promise<LessonEventDigestSource | null> {
    const lesson = await this.lessonsRepo
      .createQueryBuilder('lesson')
      .leftJoin('lesson.stages', 'stages')
      .select([
        'lesson.id',
        'lesson.status',
        'lesson.weekMaterialId',
        'lesson.publicationFailureMessage',
        'stages.id',
        'stages.type',
        'stages.status',
        'stages.lockVersion',
        'stages.currentVersionId',
        'stages.failureCode',
        'stages.failureMessage',
      ])
      .where('lesson.id = :id', { id })
      .getOne();
    if (!lesson) return null;
    const commentCount = await this.commentsRepo
      .createQueryBuilder('comment')
      .where('comment.lesson = :id', { id })
      .getCount();
    return {
      id: lesson.id,
      status: lesson.status,
      weekMaterialId: lesson.weekMaterialId ?? null,
      publicationFailureMessage: lesson.publicationFailureMessage ?? null,
      stages: (lesson.stages ?? []).map((stage) => ({
        type: stage.type,
        status: stage.status,
        lockVersion: stage.lockVersion ?? 0,
        currentVersionId: stage.currentVersionId ?? null,
        failureCode: stage.failureCode ?? null,
        failureMessage: stage.failureMessage ?? null,
      })),
      commentCount,
    };
  }

  async findStageById(stageId: string): Promise<LessonStageEntity | null> {
    return this.stagesRepo.findOne({ where: { id: stageId } });
  }

  /** Creation instants of the given versions, without loading their JSON. */
  async findVersionCreationDates(
    versionIds: readonly string[],
    manager?: EntityManager,
  ): Promise<Map<string, Date>> {
    const ids = [...new Set(versionIds)];
    if (!ids.length) return new Map();
    const rows = await this.versions(manager)
      .createQueryBuilder('version')
      .select(['version.id', 'version.createdAt'])
      .where('version.id IN (:...ids)', { ids })
      .getMany();
    return new Map(rows.map((row) => [row.id, row.createdAt]));
  }

  async findVersionById(
    versionId: string,
    manager?: EntityManager,
  ): Promise<LessonVersionEntity | null> {
    return this.versions(manager).findOne({ where: { id: versionId } });
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

  async resolveComment(
    lessonId: string,
    commentId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const result = await this.comments(manager)
      .createQueryBuilder()
      .update(LessonCommentEntity)
      .set({ isResolved: true })
      .where('id = :commentId', { commentId })
      .andWhere('lesson_id = :lessonId', { lessonId })
      .execute();
    return result.affected === 1;
  }
}
