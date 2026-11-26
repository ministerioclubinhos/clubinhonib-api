import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PlaySubmissionEntity } from '../entities/play-submission.entity';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';
import {
  PLAY_SUBMISSIONS_DEFAULT_LIMIT,
  PLAY_SUBMISSIONS_DEFAULT_PAGE,
  PLAY_SUBMISSIONS_MINE_LIMIT,
} from '../constants';

@Injectable()
export class PlaySubmissionRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PlaySubmissionEntity)
    private readonly repo: Repository<PlaySubmissionEntity>,
  ) {}

  runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  private scoped(manager?: EntityManager): Repository<PlaySubmissionEntity> {
    return manager ? manager.getRepository(PlaySubmissionEntity) : this.repo;
  }

  create(values: Partial<PlaySubmissionEntity>): Promise<PlaySubmissionEntity> {
    return this.repo.save(this.repo.create(values));
  }

  findById(id: string, manager?: EntityManager) {
    return this.scoped(manager).findOne({
      where: { id },
      relations: { submittedBy: true },
    });
  }

  save(submission: PlaySubmissionEntity, manager?: EntityManager) {
    return this.scoped(manager).save(submission);
  }

  async remove(submission: PlaySubmissionEntity): Promise<void> {
    await this.repo.remove(submission);
  }

  countPendingOf(userId: string): Promise<number> {
    return this.repo.count({
      where: { submittedById: userId, status: PlaySubmissionStatus.PENDING },
    });
  }

  findMine(userId: string): Promise<PlaySubmissionEntity[]> {
    return this.repo.find({
      where: { submittedById: userId },
      order: { createdAt: 'DESC' },
      take: PLAY_SUBMISSIONS_MINE_LIMIT,
    });
  }

  /** Fila do admin: mais antigos primeiro nos pendentes, mais recentes nos demais. */
  async findPage(
    status: PlaySubmissionStatus,
    page = PLAY_SUBMISSIONS_DEFAULT_PAGE,
    limit = PLAY_SUBMISSIONS_DEFAULT_LIMIT,
  ): Promise<{ items: PlaySubmissionEntity[]; total: number }> {
    const [items, total] = await this.repo.findAndCount({
      where: { status },
      relations: { submittedBy: true },
      order: {
        createdAt: status === PlaySubmissionStatus.PENDING ? 'ASC' : 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async countByStatus(): Promise<Record<PlaySubmissionStatus, number>> {
    const rows = await this.repo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .groupBy('s.status')
      .getRawMany<{ status: PlaySubmissionStatus; total: string }>();
    const counts = {
      [PlaySubmissionStatus.PENDING]: 0,
      [PlaySubmissionStatus.APPROVED]: 0,
      [PlaySubmissionStatus.REJECTED]: 0,
    };
    for (const row of rows) counts[row.status] = Number(row.total);
    return counts;
  }
}
