import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { CreateIdeaAiEnhancementService } from './create-idea-ai-enhancement.service';
import { CreateIdeaSnapshotService } from './create-idea-snapshot.service';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import {
  attempt,
  section,
  settings,
  snapshot,
  source,
} from '../testing/fixtures';
import {
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
  IdeaAiMediaStatus,
  IdeaAiScope,
} from '../enums/ideas-section-ai.enums';
import { IDEA_AI } from '../constants';
import { ErrorCode } from 'src/shared/exceptions';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
describe('CreateIdeaAiEnhancementService', () => {
  const manager = {} as EntityManager;
  const repo = {
    transaction: jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
    lockSection: jest.fn(),
    attempts: jest.fn(),
    saveAttempt: jest.fn(),
    mediaResults: jest.fn(),
  };
  const snapshots = { capture: jest.fn() };
  const flags = { isSwitchedOn: jest.fn() };
  const providerSettings = { getInternalSettings: jest.fn() };
  let service: CreateIdeaAiEnhancementService;
  beforeEach(async () => {
    jest.clearAllMocks();
    repo.lockSection.mockResolvedValue(section);
    repo.attempts.mockResolvedValue([]);
    repo.mediaResults.mockResolvedValue([]);
    providerSettings.getInternalSettings.mockResolvedValue(settings);
    repo.saveAttempt.mockImplementation((data: object) => ({
      id: 'new',
      ...data,
    }));
    snapshots.capture.mockResolvedValue(snapshot);
    flags.isSwitchedOn.mockResolvedValue(true);
    const module = await Test.createTestingModule({
      providers: [
        CreateIdeaAiEnhancementService,
        { provide: IdeasSectionAiRepository, useValue: repo },
        { provide: CreateIdeaSnapshotService, useValue: snapshots },
        {
          provide: MediaItemProcessor,
          useValue: {
            findMediaItemsByTargetInTransaction: jest
              .fn()
              .mockResolvedValue([]),
          },
        },
        { provide: GetAiProviderSettingsService, useValue: providerSettings },
        { provide: GetFeatureFlagsService, useValue: flags },
      ],
    }).compile();
    service = module.get(CreateIdeaAiEnhancementService);
  });
  it('manual request succeeds with the flag on and stores no keys', async () => {
    await expect(service.create(section.id)).resolves.toMatchObject({
      id: 'new',
      status: IdeaAiEnhancementStatus.PENDING,
    });
    expect(flags.isSwitchedOn).toHaveBeenCalledWith(
      FeatureFlagKeys.IDEA_AI_ENHANCEMENT,
      false,
    );
    expect(JSON.stringify(repo.saveAttempt.mock.calls)).not.toContain(
      'test-key',
    );
  });
  it('the flag off blocks automatic and manual requests', async () => {
    flags.isSwitchedOn.mockResolvedValue(false);
    await service.enqueueAutomatic(section.id);
    await expect(
      service.create(section.id, { scope: IdeaAiScope.TEXT }),
    ).rejects.toMatchObject({ code: ErrorCode.FEATURE_DISABLED });
    expect(repo.lockSection).not.toHaveBeenCalled();
    expect(repo.saveAttempt).not.toHaveBeenCalled();
    flags.isSwitchedOn.mockResolvedValue(true);
    await service.enqueueAutomatic(section.id);
    expect(repo.saveAttempt).toHaveBeenCalledTimes(1);
  });
  it.each([
    IdeaAiEnhancementStatus.PENDING,
    IdeaAiEnhancementStatus.PROCESSING,
  ])('rejects concurrent request %s', async (status) => {
    repo.attempts.mockResolvedValue([{ ...attempt, status }]);
    await expect(service.create(section.id)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('uses sequential numbers without overwriting previous results', async () => {
    repo.attempts.mockResolvedValue([
      { ...attempt, status: IdeaAiEnhancementStatus.FAILED },
    ]);
    await expect(service.create(section.id)).resolves.toMatchObject({
      attempt: 2,
    });
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: snapshot.id,
        currentResultSectionId: null,
      }),
      manager,
    );
  });
  it('refuses automatic and manual work once the idea is published', async () => {
    repo.lockSection.mockResolvedValue({ ...section, page: { id: 'page' } });
    flags.isSwitchedOn.mockResolvedValue(true);
    await expect(service.enqueueAutomatic(section.id)).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_ALREADY_PUBLISHED,
    });
    await expect(service.create(section.id)).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_ALREADY_PUBLISHED,
    });
    expect(repo.saveAttempt).not.toHaveBeenCalled();
  });
  it('rejects a new attempt after the counted limit', async () => {
    repo.attempts.mockResolvedValue(
      Array.from({ length: IDEA_AI.maxAttempts }, (_, n) => ({
        ...attempt,
        attempt: n + 1,
        status: IdeaAiEnhancementStatus.FAILED,
        errorCode: IdeaAiErrorCode.GUARD_REJECTED,
      })),
    );
    await expect(service.create(section.id)).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_ATTEMPT_LIMIT,
    });
  });
  it('does not count cancellations and infrastructure failures', async () => {
    repo.attempts.mockResolvedValue(
      [
        IdeaAiErrorCode.CANCELLED,
        IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED,
        IdeaAiErrorCode.STALLED,
        IdeaAiErrorCode.QUEUE_UNAVAILABLE,
        IdeaAiErrorCode.SNAPSHOT_MISSING,
      ].map((errorCode, n) => ({
        ...attempt,
        attempt: 5 - n,
        status: IdeaAiEnhancementStatus.FAILED,
        errorCode,
      })),
    );
    await expect(service.create(section.id)).resolves.toMatchObject({
      attempt: 6,
    });
  });
  it('refuses a manual request and skips the automatic one without a provider', async () => {
    providerSettings.getInternalSettings.mockResolvedValue({
      ...settings,
      openai: { ...settings.openai, apiKey: '' },
    });
    await expect(service.create(section.id)).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_PROVIDER_NOT_CONFIGURED,
    });
    await expect(service.enqueueAutomatic(section.id)).resolves.toBeUndefined();
    expect(repo.saveAttempt).not.toHaveBeenCalled();
  });
  describe('targeted scopes', () => {
    const current = {
      ...attempt,
      id: 'current',
      status: IdeaAiEnhancementStatus.PARTIAL,
      currentResultSectionId: section.id,
      enhancedTitle: 'Título',
      enhancedDescription: null,
    };
    it('partial scopes need a current result', async () => {
      await expect(
        service.create(section.id, { scope: IdeaAiScope.TEXT }),
      ).rejects.toMatchObject({ code: ErrorCode.IDEA_AI_INVALID_SCOPE });
    });
    it('text scope stores instructions and the base result', async () => {
      repo.attempts.mockResolvedValue([current]);
      await service.create(section.id, {
        scope: IdeaAiScope.TEXT,
        instructions: 'Mais curto',
      });
      expect(repo.saveAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: IdeaAiScope.TEXT,
          includeText: true,
          targetMediaIds: [],
          baseEnhancementId: 'current',
          instructions: 'Mais curto',
          progressTotal: 1,
        }),
        manager,
      );
    });
    it('media scope accepts only uploaded documents and images of the snapshot', async () => {
      repo.attempts.mockResolvedValue([current]);
      await expect(
        service.create(section.id, {
          scope: IdeaAiScope.MEDIA,
          mediaIds: ['unknown'],
        }),
      ).rejects.toMatchObject({ code: ErrorCode.IDEA_AI_INVALID_SCOPE });
      await service.create(section.id, {
        scope: IdeaAiScope.MEDIA,
        mediaIds: [source.id],
      });
      expect(repo.saveAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          includeText: false,
          targetMediaIds: [source.id],
          progressTotal: 1,
        }),
        manager,
      );
    });
    it('failed scope redoes rejected text and failed media only', async () => {
      repo.attempts.mockResolvedValue([current]);
      repo.mediaResults.mockResolvedValue([
        {
          enhancementId: 'current',
          sourceMediaId: source.id,
          status: IdeaAiMediaStatus.REJECTED_BY_GUARD,
        },
      ]);
      await service.create(section.id, { scope: IdeaAiScope.FAILED });
      expect(repo.saveAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          includeText: true,
          targetMediaIds: [source.id],
        }),
        manager,
      );
    });
    it('failed scope with nothing failed is refused', async () => {
      repo.attempts.mockResolvedValue([
        { ...current, enhancedDescription: 'ok' },
      ]);
      await expect(
        service.create(section.id, { scope: IdeaAiScope.FAILED }),
      ).rejects.toMatchObject({ code: ErrorCode.IDEA_AI_INVALID_SCOPE });
    });
  });
  it('does not count videos in the progress and refuses them as targets', async () => {
    const video = {
      ...source,
      id: 'video',
      mediaType: MediaType.VIDEO,
      url: 'https://www.youtube.com/watch?v=abc123def45',
      isLocalFile: false,
    };
    snapshots.capture.mockResolvedValue({
      ...snapshot,
      medias: [
        ...snapshot.medias,
        {
          sourceMediaId: video.id,
          sourceMedia: video,
          url: video.url,
          position: 1,
        },
      ],
    });
    await service.create(section.id);
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ progressTotal: 2 }),
      manager,
    );
    repo.attempts.mockResolvedValue([
      {
        ...attempt,
        status: IdeaAiEnhancementStatus.COMPLETED,
        currentResultSectionId: section.id,
      },
    ]);
    await expect(
      service.create(section.id, {
        scope: IdeaAiScope.MEDIA,
        mediaIds: [video.id],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.IDEA_AI_INVALID_SCOPE });
  });
});
