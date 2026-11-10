import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { CreateIdeaAiEnhancementService } from './create-idea-ai-enhancement.service';
import { CreateIdeaSnapshotService } from './create-idea-snapshot.service';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { attempt, section, settings, snapshot } from '../testing/fixtures';
import { IdeaAiEnhancementStatus } from '../enums/ideas-section-ai.enums';
describe('CreateIdeaAiEnhancementService', () => {
  const manager = {} as EntityManager;
  const repo = {
    transaction: jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
    lockSection: jest.fn(),
    attempts: jest.fn(),
    saveAttempt: jest.fn(),
  };
  const snapshots = { capture: jest.fn() };
  const flags = { isSwitchedOn: jest.fn() };
  let service: CreateIdeaAiEnhancementService;
  beforeEach(async () => {
    jest.clearAllMocks();
    repo.lockSection.mockResolvedValue(section);
    repo.attempts.mockResolvedValue([]);
    repo.saveAttempt.mockImplementation((data: object) => ({
      id: 'new',
      ...data,
    }));
    snapshots.capture.mockResolvedValue(snapshot);
    flags.isSwitchedOn.mockResolvedValue(false);
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
        {
          provide: GetAiProviderSettingsService,
          useValue: {
            getInternalSettings: jest.fn().mockResolvedValue(settings),
          },
        },
        { provide: GetFeatureFlagsService, useValue: flags },
      ],
    }).compile();
    service = module.get(CreateIdeaAiEnhancementService);
  });
  it('manual request succeeds with automatic flag disabled and stores no keys', async () => {
    await expect(service.create(section.id)).resolves.toMatchObject({
      id: 'new',
      status: IdeaAiEnhancementStatus.PENDING,
    });
    expect(flags.isSwitchedOn).not.toHaveBeenCalled();
    expect(JSON.stringify(repo.saveAttempt.mock.calls)).not.toContain(
      'test-key',
    );
  });
  it('automatic request is controlled only by the flag', async () => {
    await service.enqueueAutomatic(section.id);
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
  it('does not enqueue delayed automatic work after publication, but allows manual review', async () => {
    repo.lockSection.mockResolvedValue({ ...section, page: { id: 'page' } });
    flags.isSwitchedOn.mockResolvedValue(true);
    await expect(service.enqueueAutomatic(section.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(repo.saveAttempt).not.toHaveBeenCalled();
    await expect(service.create(section.id)).resolves.toMatchObject({
      status: IdeaAiEnhancementStatus.PENDING,
    });
  });
  it('rejects the fourth attempt', async () => {
    repo.attempts.mockResolvedValue(
      [1, 2, 3].map((n) => ({
        ...attempt,
        attempt: n,
        status: IdeaAiEnhancementStatus.FAILED,
      })),
    );
    await expect(service.create(section.id)).rejects.toMatchObject({
      status: 409,
    });
  });
});
