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
  async cancel(sectionId: string, manager: EntityManager): Promise<void> {
    await manager.update(
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
  }
  async clearCurrent(sectionId: string, manager: EntityManager): Promise<void> {
    await manager.update(
      Attempt,
      { sectionId },
      { currentResultSectionId: null },
    );
  }
  /** Atomic compare-and-swap: crashed leases are reclaimable; live ones are never stolen. */
  async claim(owner: string): Promise<Attempt | null> {
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
    const changed = await this.db
      .getRepository(Attempt)
      .createQueryBuilder()
      .update()
      .set({
        status: IdeaAiEnhancementStatus.PROCESSING,
        leaseOwner: owner,
        leaseExpiresAt: new Date(Date.now() + IDEA_AI.leaseMs),
        startedAt: new Date(),
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
          status: IdeaAiEnhancementStatus.PROCESSING,
        }
      : null;
  }
  async renew(id: string, owner: string): Promise<boolean> {
    const result = await this.db
      .getRepository(Attempt)
      .createQueryBuilder()
      .update()
      .set({ leaseExpiresAt: new Date(Date.now() + IDEA_AI.leaseMs) })
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
  async deleteHistory(
    sectionId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.delete(Choice, { sectionId });
    await manager.delete(Attempt, { sectionId });
    await manager.delete(Snapshot, { sectionId });
  }
}
