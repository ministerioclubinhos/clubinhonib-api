import { EntityManager } from 'typeorm';
import { ErrorCode } from 'src/shared/exceptions';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { UpdateIdeaAiEnhancementService } from './update-idea-ai-enhancement.service';
import { attempt, section } from '../testing/fixtures';
import { IdeaAiEnhancementStatus } from '../enums/ideas-section-ai.enums';

describe('UpdateIdeaAiEnhancementService', () => {
  const manager = {} as EntityManager;
  const repo = {
    transaction: jest.fn(),
    lockSection: jest.fn(),
    cancel: jest.fn(),
    attempts: jest.fn(),
    setCurrent: jest.fn(),
  };
  const service = new UpdateIdeaAiEnhancementService(
    repo as unknown as IdeasSectionAiRepository,
  );
  const finished = {
    ...attempt,
    id: 'old',
    status: IdeaAiEnhancementStatus.PARTIAL,
  };
  beforeEach(() => {
    jest.resetAllMocks();
    repo.transaction.mockImplementation(
      (work: (m: EntityManager) => Promise<unknown>) => work(manager),
    );
    repo.lockSection.mockResolvedValue(section);
    repo.attempts.mockResolvedValue([finished]);
  });

  it('cancels the active attempt under the section lock', async () => {
    repo.cancel.mockResolvedValue(true);
    await service.cancel(section.id);
    expect(repo.lockSection).toHaveBeenCalledWith(section.id, manager);
    expect(repo.cancel).toHaveBeenCalledWith(section.id, manager);
  });

  it('reports when there is nothing to cancel or the idea is gone', async () => {
    repo.cancel.mockResolvedValue(false);
    await expect(service.cancel(section.id)).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_NO_ACTIVE_ATTEMPT,
    });
    repo.lockSection.mockResolvedValue(null);
    await expect(service.cancel(section.id)).rejects.toMatchObject({
      code: ErrorCode.IDEA_NOT_FOUND,
    });
  });

  it('restores a finished result as current', async () => {
    await service.restore(section.id, 'old');
    expect(repo.setCurrent).toHaveBeenCalledWith(section.id, 'old', manager);
  });

  it('refuses to restore while active, after publication or without a result', async () => {
    repo.attempts.mockResolvedValue([finished, attempt]);
    await expect(service.restore(section.id, 'old')).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_ENHANCEMENT_IN_PROGRESS,
    });
    repo.attempts.mockResolvedValue([
      { ...finished, status: IdeaAiEnhancementStatus.FAILED },
    ]);
    await expect(service.restore(section.id, 'old')).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_RESULT_UNAVAILABLE,
    });
    repo.lockSection.mockResolvedValue({ ...section, page: { id: 'page' } });
    await expect(service.restore(section.id, 'old')).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_ALREADY_PUBLISHED,
    });
    expect(repo.setCurrent).not.toHaveBeenCalled();
  });
});
