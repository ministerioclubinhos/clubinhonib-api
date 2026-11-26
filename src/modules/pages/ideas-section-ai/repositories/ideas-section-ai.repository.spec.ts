import { DataSource } from 'typeorm';
import { IdeasSectionAiRepository } from './ideas-section-ai.repository';
import { attempt } from '../testing/fixtures';
import {
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
} from '../enums/ideas-section-ai.enums';
import { IDEA_AI } from '../constants';
import { leaseExpression } from '../utils';

describe('worker lease arbitration', () => {
  const query = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    execute: jest.fn(),
  };
  const db = {
    getRepository: () => ({ createQueryBuilder: () => query }),
  } as unknown as DataSource;
  const repo = new IdeasSectionAiRepository(db);
  beforeEach(() => {
    jest.clearAllMocks();
    query.getOne.mockResolvedValue({ ...attempt, claimCount: 0 });
    query.execute.mockResolvedValue({ affected: 1 });
  });
  it('closes an attempt reclaimed too many times as STALLED and moves on', async () => {
    query.getOne
      .mockResolvedValueOnce({ ...attempt, claimCount: IDEA_AI.maxClaims })
      .mockResolvedValueOnce(null);
    await expect(repo.claim('owner')).resolves.toBeNull();
    expect(query.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IdeaAiEnhancementStatus.FAILED,
        errorCode: IdeaAiErrorCode.STALLED,
        activeSectionId: null,
      }),
    );
  });
  it('uses the database clock for the lease and counts the claim', async () => {
    await repo.claim('owner');
    const calls = query.set.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    const values = calls[0][0];
    expect((values.leaseExpiresAt as () => string)()).toBe(leaseExpression());
    expect((values.claimCount as () => string)()).toBe('claim_count + 1');
    expect(leaseExpression()).toBe(
      'DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 90 SECOND)',
    );
  });
  it('records progress when renewing', async () => {
    await repo.renew('attempt', 'owner', { done: 2, total: 3 });
    expect(query.set).toHaveBeenCalledWith(
      expect.objectContaining({ progressDone: 2, progressTotal: 3 }),
    );
  });
  it('reclaims expired processing work under a new owner', async () => {
    await expect(repo.claim('new-owner')).resolves.toMatchObject({
      leaseOwner: 'new-owner',
      status: IdeaAiEnhancementStatus.PROCESSING,
    });
    expect(query.where).toHaveBeenCalledWith(
      expect.stringContaining('a.leaseExpiresAt < CURRENT_TIMESTAMP'),
      {
        pending: IdeaAiEnhancementStatus.PENDING,
        processing: IdeaAiEnhancementStatus.PROCESSING,
      },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('lease_expires_at < CURRENT_TIMESTAMP'),
      {
        pending: IdeaAiEnhancementStatus.PENDING,
        processing: IdeaAiEnhancementStatus.PROCESSING,
      },
    );
  });
  it('does not process a candidate claimed by a competing worker', async () => {
    query.execute.mockResolvedValue({ affected: 0 });
    await expect(repo.claim('losing-owner')).resolves.toBeNull();
  });
  it('cannot renew an expired, cancelled or replaced lease', async () => {
    query.execute.mockResolvedValue({ affected: 0 });
    await expect(repo.renew('attempt', 'old-owner')).resolves.toBe(false);
    expect(query.where).toHaveBeenCalledWith(
      expect.stringContaining(
        'lease_owner = :owner AND status = :status AND lease_expires_at > CURRENT_TIMESTAMP',
      ),
      {
        id: 'attempt',
        owner: 'old-owner',
        status: IdeaAiEnhancementStatus.PROCESSING,
      },
    );
  });
});
