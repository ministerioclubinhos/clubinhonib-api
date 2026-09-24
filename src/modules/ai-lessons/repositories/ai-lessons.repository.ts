import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { LessonStatus } from '../enums/lesson.enums';

@Injectable()
export class AiLessonsRepository {
  constructor(
    @InjectRepository(LessonEntity)
    private readonly lessonsRepo: Repository<LessonEntity>,
    @InjectRepository(LessonStageEntity)
    private readonly stagesRepo: Repository<LessonStageEntity>,
    @InjectRepository(LessonVersionEntity)
    private readonly versionsRepo: Repository<LessonVersionEntity>,
  ) {}

  createLesson(data: Partial<LessonEntity>): LessonEntity {
    return this.lessonsRepo.create(data);
  }

  async saveLesson(lesson: LessonEntity): Promise<LessonEntity> {
    return this.lessonsRepo.save(lesson);
  }

  async findLessonById(id: string): Promise<LessonEntity | null> {
    return this.lessonsRepo.findOne({
      where: { id },
      relations: ['stages', 'stages.versions', 'comments'],
    });
  }

  async findDraftsPaginated(
    status?: LessonStatus,
    page = 1,
    limit = 10,
  ): Promise<{ items: LessonEntity[]; total: number }> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

    const query = this.lessonsRepo
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.stages', 'stages')
      .orderBy('lesson.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (status) {
      query.andWhere('lesson.status = :status', { status });
    }

    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  async getDashboardStatusCounts(): Promise<Array<{ status: LessonStatus; count: string }>> {
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

  async removeLesson(lesson: LessonEntity): Promise<void> {
    await this.lessonsRepo.remove(lesson);
  }

  createStage(data: Partial<LessonStageEntity>): LessonStageEntity {
    return this.stagesRepo.create(data);
  }

  async saveStage(stage: LessonStageEntity): Promise<LessonStageEntity> {
    return this.stagesRepo.save(stage);
  }

  async saveStages(stages: LessonStageEntity[]): Promise<LessonStageEntity[]> {
    return this.stagesRepo.save(stages);
  }

  createVersion(data: Partial<LessonVersionEntity>): LessonVersionEntity {
    return this.versionsRepo.create(data);
  }

  async saveVersion(version: LessonVersionEntity): Promise<LessonVersionEntity> {
    return this.versionsRepo.save(version);
  }
}
