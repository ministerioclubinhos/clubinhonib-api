import { GetIdeaAiEnhancementService } from './get-idea-ai-enhancement.service';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { attempt, settings, snapshot } from '../testing/fixtures';
import {
  IdeaAiDecision,
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
  IdeaAiMediaStatus,
  IdeaAiPublicationField,
  IdeaAiScope,
} from '../enums/ideas-section-ai.enums';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';

const flagsOn = { isSwitchedOn: jest.fn().mockResolvedValue(true) };
const providerSettings = {
  getInternalSettings: jest.fn().mockResolvedValue(settings),
};
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
    providerSettings as unknown as GetAiProviderSettingsService,
    flagsOn as unknown as GetFeatureFlagsService,
  ).get('section');
  expect(detail.activeAttempt?.id).toBe(attempt.id);
  expect(detail.currentResult?.id).toBe('previous');
  expect(detail.publicationChoices[0].enhancementId).toBe('previous');
  expect(JSON.stringify(detail)).not.toContain('must not escape');
  expect(JSON.stringify(detail)).not.toContain('configured-text');
  expect(JSON.stringify(detail)).not.toContain('test-key');
  expect(detail.providerReady).toBe(true);
  expect(detail.enabled).toBe(true);
  expect(detail.attemptsUsed).toBe(2);
  expect(detail.currentResult).toMatchObject({
    scope: IdeaAiScope.FULL,
    countsTowardLimit: true,
    progressTotal: 2,
  });
});
it('reports progress, base attempt, carried media and uncounted attempts', async () => {
  const base = {
    ...attempt,
    id: 'base',
    attempt: 1,
    status: IdeaAiEnhancementStatus.COMPLETED,
  };
  const cancelled = {
    ...attempt,
    id: 'cancelled',
    attempt: 2,
    status: IdeaAiEnhancementStatus.SKIPPED,
    errorCode: IdeaAiErrorCode.CANCELLED,
  };
  const active = {
    ...attempt,
    id: 'active',
    attempt: 3,
    scope: IdeaAiScope.MEDIA,
    baseEnhancementId: 'base',
    startedAt: new Date('2026-01-02T10:00:00Z'),
    progressDone: 1,
    progressTotal: 3,
  };
  const repo = {
    snapshot: jest.fn().mockResolvedValue(null),
    attempts: jest.fn().mockResolvedValue([active, cancelled, base]),
    mediaResults: jest.fn().mockResolvedValue([
      {
        enhancementId: 'base',
        sourceMediaId: 'source',
        status: IdeaAiMediaStatus.ENHANCED,
        errorCode: IdeaAiErrorCode.GUARD_REJECTED,
        carriedOver: true,
        guard: null,
        enhancedMedia: null,
        editableMedia: null,
      },
    ]),
    publicationChoices: jest.fn().mockResolvedValue([]),
  };
  const detail = await new GetIdeaAiEnhancementService(
    repo as unknown as IdeasSectionAiRepository,
    {
      getInternalSettings: jest.fn().mockResolvedValue({
        ...settings,
        openai: { ...settings.openai, apiKey: '' },
      }),
    } as unknown as GetAiProviderSettingsService,
    {
      isSwitchedOn: jest.fn().mockResolvedValue(false),
    } as unknown as GetFeatureFlagsService,
  ).get('section');
  expect(detail.providerReady).toBe(false);
  expect(detail.enabled).toBe(false);
  expect(detail.attemptsUsed).toBe(2);
  expect(detail.activeAttempt).toMatchObject({
    baseAttempt: 1,
    progressDone: 1,
    progressTotal: 3,
    startedAt: '2026-01-02T10:00:00.000Z',
  });
  expect(
    detail.attemptHistory.find((a) => a.id === 'cancelled')?.countsTowardLimit,
  ).toBe(false);
  expect(
    detail.attemptHistory.find((a) => a.id === 'base')?.medias[0],
  ).toMatchObject({
    carriedOver: true,
    errorCode: IdeaAiErrorCode.GUARD_REJECTED,
  });
});
