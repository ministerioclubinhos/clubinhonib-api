import { toIdeaAiAttempt } from './mappers';
import { attempt } from './testing/fixtures';
describe('safe enhancement DTO', () => {
  it('excludes provider models, keys, prompts and lease internals', () => {
    const result = toIdeaAiAttempt(
      {
        ...attempt,
        leaseOwner: 'secret-owner',
        textModel: 'internal-model',
        promptVersion: 'internal-prompt',
      },
      [],
    );
    expect(result.id).toBe(attempt.id);
    for (const key of [
      'provider',
      'textModel',
      'promptVersion',
      'leaseOwner',
      'leaseExpiresAt',
      'activeSectionId',
      'snapshotId',
    ])
      expect(result).not.toHaveProperty(key);
  });
});
