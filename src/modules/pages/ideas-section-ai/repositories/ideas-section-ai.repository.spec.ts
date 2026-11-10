import { DataSource } from 'typeorm';
import { IdeasSectionAiRepository } from './ideas-section-ai.repository';
import { attempt } from '../testing/fixtures';
import { IdeaAiEnhancementStatus } from '../enums/ideas-section-ai.enums';

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
    query.getOne.mockResolvedValue(attempt);
    query.execute.mockResolvedValue({ affected: 1 });
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
