import { IdeasSectionAiEnhancementJob } from './ideas-section-ai-enhancement.job';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { ProcessIdeaAiEnhancementService } from '../services/process-idea-ai-enhancement.service';
import { attempt } from '../testing/fixtures';
describe('idea worker leases', () => {
  it('claims on startup, serializes work and renews the same owner', async () => {
    jest.useFakeTimers();
    let finish: () => void = () => undefined;
    const repo = {
      claim: jest
        .fn<Promise<typeof attempt>, [string]>()
        .mockResolvedValue(attempt),
      renew: jest.fn().mockResolvedValue(true),
    };
    const processor = {
      process: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    const job = new IdeasSectionAiEnhancementJob(
      repo as unknown as IdeasSectionAiRepository,
      processor as unknown as ProcessIdeaAiEnhancementService,
    );
    job.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(21_000);
    expect(repo.claim).toHaveBeenCalledTimes(1);
    expect(repo.renew).toHaveBeenCalledWith(
      attempt.id,
      repo.claim.mock.calls[0][0],
    );
    expect(processor.process).toHaveBeenCalledWith(
      attempt,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    job.onModuleDestroy();
    finish();
    await jest.runAllTimersAsync();
    jest.useRealTimers();
  });
});
