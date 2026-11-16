import { AppForbiddenException } from 'src/shared/exceptions';
import { GetIdeaAiEnhancementService } from '../services/get-idea-ai-enhancement.service';
import { IdeaAiEnabledGuard } from './idea-ai-enabled.guard';

const guardWith = (enabled: boolean) =>
  new IdeaAiEnabledGuard({
    isEnabled: jest.fn().mockResolvedValue(enabled),
  } as unknown as GetIdeaAiEnhancementService);

it('lets admin AI endpoints through when the flag is on', async () => {
  await expect(guardWith(true).canActivate()).resolves.toBe(true);
});

it('refuses every admin AI endpoint when the flag is off', async () => {
  await expect(guardWith(false).canActivate()).rejects.toBeInstanceOf(
    AppForbiddenException,
  );
});
