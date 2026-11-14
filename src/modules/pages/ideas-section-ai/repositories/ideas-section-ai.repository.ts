import { Injectable } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager, In } from 'typeorm';
import { IdeasSectionEntity } from '../../ideas-page/entities/ideas-section.entity';
import { IdeasSectionAiEnhancementEntity as Attempt } from '../entities/ideas-section-ai-enhancement.entity';
import { IdeasSectionSubmissionSnapshotEntity as Snapshot } from '../entities/ideas-section-submission-snapshot.entity';
import { IdeasSectionAiMediaEnhancementEntity as MediaResult } from '../entities/ideas-section-ai-media-enhancement.entity';
import { IdeasSectionAiPublicationChoiceEntity as Choice } from '../entities/ideas-section-ai-publication-choice.entity';
import { IDEA_AI, IDEA_AI_ACTIVE } from '../constants';
import {
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
} from '../enums/ideas-section-ai.enums';
import { IdeaAiProgress } from '../types';
import { leaseExpression } from '../utils';
@Injectable()
export class IdeasSectionAiRepository {
  constructor(private readonly db: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
  lockSection(
    id: string,
    manager: EntityManager,
  ): Promise<IdeasSectionEntity | null> {
    return manager.findOne(IdeasSectionEntity, {
      where: { id },
      relations: { page: true },
      lock: { mode: 'pessimistic_write' },
    });
  }
  snapshot(
    sectionId: string,
    manager = this.db.manager,
  ): Promise<Snapshot | null> {
    return manager.findOne(Snapshot, {
      where: { sectionId },
      relations: { medias: { sourceMedia: true } },
    });
  }
  saveSnapshot(
    data: DeepPartial<Snapshot>,
    manager: EntityManager,
  ): Promise<Snapshot> {
    return manager.save(Snapshot, data);
  }
  attempts(
    sectionIds: string[],
    manager = this.db.manager,
  ): Promise<Attempt[]> {
    if (!sectionIds.length) return Promise.resolve([]);
    return manager.find(Attempt, {
      where: { sectionId: In(sectionIds) },
      order: { attempt: 'DESC' },
    });
  }
  findAttempt(id: string, manager = this.db.manager): Promise<Attempt | null> {
    return manager.findOne(Attempt, { where: { id } });
  }
  mediaResults(
    ids: string[],
    manager = this.db.manager,
  ): Promise<MediaResult[]> {
    if (!ids.length) return Promise.resolve([]);
    return manager.find(MediaResult, {
      where: { enhancementId: In(ids) },
      relations: { enhancedMedia: true, editableMedia: true },
    });
  }
  saveAttempt(
    data: DeepPartial<Attempt>,
    manager: EntityManager,
  ): Promise<Attempt> {
    return manager.save(Attempt, data);
  }
  saveMediaResult(
    data: DeepPartial<MediaResult>,
    manager: EntityManager,
  ): Promise<MediaResult> {
    return manager.save(MediaResult, data);
  }
  publicationChoices(sectionId: string): Promise<Choice[]> {
    return this.db.manager.find(Choice, { where: { sectionId } });
  }
  async replaceChoices(
    sectionId: string,
    data: DeepPartial<Choice>[],
    manager: EntityManager,
  ): Promise<void> {
    await manager.delete(Choice, { sectionId });
    await manager.save(Choice, data);
  }
  /** Cancels the active attempt; returns whether one existed. */
  async cancel(sectionId: string, manager: EntityManager): Promise<boolean> {
    const result = await manager.update(
      Attempt,
      { sectionId, status: In(IDEA_AI_ACTIVE) },
      {
        status: IdeaAiEnhancementStatus.SKIPPED,
        errorCode: IdeaAiErrorCode.CANCELLED,
        activeSectionId: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        finishedAt: new Date(),
      },
    );
    return Boolean(result.affected);
  }
  async clearCurrent(sectionId: string, manager: EntityManager): Promise<void> {
    await manager.update(
      Attempt,
      { sectionId },
      { currentResultSectionId: null },
    );
  }
  /**
   * Atomic compare-and-swap: crashed leases are reclaimable; live ones are
   * never stolen. Lease times use the database clock on both sides, so a
   * timezone or clock skew between app and MySQL cannot shorten or extend a
   * lease. A crashed attempt is reclaimed at most `maxClaims` times; after
   * that it is closed as STALLED instead of looping (and billing) forever.
   */
  async claim(owner: string): Promise<Attempt | null> {
    for (let guard = 0; guard < IDEA_AI.maxClaims + 1; guard++) {
      const candidate = await this.db
        .getRepository(Attempt)
        .createQueryBuilder('a')
        .where(
          'a.status = :pending OR (a.status = :processing AND a.leaseExpiresAt < CURRENT_TIMESTAMP)',
          {
            pending: IdeaAiEnhancementStatus.PENDING,
            processing: IdeaAiEnhancementStatus.PROCESSING,
          },
        )
        .orderBy('a.requestedAt', 'ASC')
        .getOne();
      if (!candidate) return null;
      if (candidate.claimCount >= IDEA_AI.maxClaims) {
        await this.stall(candidate.id);
        continue;
      }
      const changed = await this.db
        .getRepository(Attempt)
        .createQueryBuilder()
        .update()
        .set({
          status: IdeaAiEnhancementStatus.PROCESSING,
          leaseOwner: owner,
          leaseExpiresAt: () => leaseExpression(),
          startedAt: () => 'CURRENT_TIMESTAMP',
          claimCount: () => 'claim_count + 1',
        })
        .where('id = :id', { id: candidate.id })
        .andWhere(
          '(status = :pending OR (status = :processing AND lease_expires_at < CURRENT_TIMESTAMP))',
          {
            pending: IdeaAiEnhancementStatus.PENDING,
            processing: IdeaAiEnhancementStatus.PROCESSING,
          },
        )
        .execute();
      return changed.affected === 1
        ? {
            ...candidate,
            leaseOwner: owner,
            claimCount: candidate.claimCount + 1,
            status: IdeaAiEnhancementStatus.PROCESSING,
          }
        : null;
    }
    return null;
  }
  /** Closes an attempt that keeps crashing the worker. */
  async stall(id: string): Promise<boolean> {
    const result = await this.db
      .getRepository(Attempt)
      .createQueryBuilder()
      .update()
      .set({
        status: IdeaAiEnhancementStatus.FAILED,
        errorCode: IdeaAiErrorCode.STALLED,
        activeSectionId: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        finishedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where(
        'id = :id AND status = :processing AND lease_expires_at < CURRENT_TIMESTAMP',
        { id, processing: IdeaAiEnhancementStatus.PROCESSING },
      )
      .execute();
    return result.affected === 1;
  }
  /** Extends the lease and, optionally, records progress for the reviewer. */
  async renew(
    id: string,
    owner: string,
    progress?: IdeaAiProgress,
  ): Promise<boolean> {
    const result = await this.db
      .getRepository(Attempt)
      .createQueryBuilder()
      .update()
      .set({
        leaseExpiresAt: () => leaseExpression(),
        ...(progress
          ? {
              progressDone: progress.done,
              progressTotal: progress.total,
            }
          : {}),
      })
      .where(
        'id = :id AND lease_owner = :owner AND status = :status AND lease_expires_at > CURRENT_TIMESTAMP',
        { id, owner, status: IdeaAiEnhancementStatus.PROCESSING },
      )
      .execute();
    return result.affected === 1;
  }
  async owned(
    id: string,
    owner: string,
    manager: EntityManager,
  ): Promise<Attempt | null> {
    return manager
      .getRepository(Attempt)
      .createQueryBuilder('a')
      .setLock('pessimistic_write')
      .where(
        'a.id = :id AND a.leaseOwner = :owner AND a.status = :status AND a.leaseExpiresAt > CURRENT_TIMESTAMP',
        { id, owner, status: IdeaAiEnhancementStatus.PROCESSING },
      )
      .getOne();
  }
  /** Makes a finished result the one the reviewer compares and publishes. */
  async setCurrent(
    sectionId: string,
    enhancementId: string,
    manager: EntityManager,
  ): Promise<void> {
    await this.clearCurrent(sectionId, manager);
    await manager.update(
      Attempt,
      { id: enhancementId, sectionId },
      { currentResultSectionId: sectionId },
    );
  }
  async deleteHistory(
    sectionId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.delete(Choice, { sectionId });
    await manager.delete(Attempt, { sectionId });
    await manager.delete(Snapshot, { sectionId });
  }
}
