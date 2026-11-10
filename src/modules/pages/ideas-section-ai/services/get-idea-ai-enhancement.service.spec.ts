import { GetIdeaAiEnhancementService } from './get-idea-ai-enhancement.service';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { attempt, snapshot } from '../testing/fixtures';
import {
  IdeaAiDecision,
  IdeaAiEnhancementStatus,
  IdeaAiPublicationField,
} from '../enums/ideas-section-ai.enums';
it('separates active work, previous result and publication choices without exposing internal settings', async () => {
  const previous = {
    ...attempt,
    id: 'previous',
    status: IdeaAiEnhancementStatus.COMPLETED,
    currentResultSectionId: 'section',
  };
  const repo = {
    snapshot: jest.fn().mockResolvedValue(snapshot),
    attempts: jest
      .fn()
      .mockResolvedValue([{ ...attempt, attempt: 2 }, previous]),
    mediaResults: jest.fn().mockResolvedValue([]),
    publicationChoices: jest.fn().mockResolvedValue([
      {
        field: IdeaAiPublicationField.TITLE,
        sourceMediaId: null,
        enhancementId: 'previous',
        decision: IdeaAiDecision.ENHANCED,
        internal: 'must not escape',
      },
    ]),
  };
  const detail = await new GetIdeaAiEnhancementService(
    repo as unknown as IdeasSectionAiRepository,
  ).get('section');
  expect(detail.activeAttempt?.id).toBe(attempt.id);
  expect(detail.currentResult?.id).toBe('previous');
  expect(detail.publicationChoices[0].enhancementId).toBe('previous');
  expect(JSON.stringify(detail)).not.toContain('must not escape');
  expect(JSON.stringify(detail)).not.toContain('configured-text');
});
