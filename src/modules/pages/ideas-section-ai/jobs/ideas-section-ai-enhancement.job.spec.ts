import { IdeasSectionAiEnhancementJob } from './ideas-section-ai-enhancement.job';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { ProcessIdeaAiEnhancementService } from '../services/process-idea-ai-enhancement.service';
import { attempt } from '../testing/fixtures';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';

const flagsOn = { isSwitchedOn: jest.fn().mockResolvedValue(true) };
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
      flagsOn as unknown as GetFeatureFlagsService,
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
  it('does not claim any work while the AI flag is off', async () => {
    const repo = { claim: jest.fn(), renew: jest.fn() };
    const processor = { process: jest.fn() };
    const flags = { isSwitchedOn: jest.fn().mockResolvedValue(false) };
    const job = new IdeasSectionAiEnhancementJob(
      repo as unknown as IdeasSectionAiRepository,
      processor as unknown as ProcessIdeaAiEnhancementService,
      flags as unknown as GetFeatureFlagsService,
    );
    await job.tick();
    expect(flags.isSwitchedOn).toHaveBeenCalledWith(
      FeatureFlagKeys.IDEA_AI_ENHANCEMENT,
      false,
    );
    expect(repo.claim).not.toHaveBeenCalled();
    expect(processor.process).not.toHaveBeenCalled();
  });
});
