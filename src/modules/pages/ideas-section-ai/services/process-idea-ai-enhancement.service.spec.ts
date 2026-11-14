import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { ProcessIdeaAiEnhancementService } from './process-idea-ai-enhancement.service';
import { EnhanceIdeaTextService } from './enhance-idea-text.service';
import { EnhanceIdeaDocumentService } from './enhance-idea-document.service';
import { EnhanceIdeaImageService } from './enhance-idea-image.service';
import {
  attempt,
  section,
  snapshot,
  settings,
  source,
} from '../testing/fixtures';
import {
  IdeaAiEnhancementStatus,
  IdeaAiMediaStatus,
} from '../enums/ideas-section-ai.enums';
describe('durable idea processing', () => {
  const manager = {} as EntityManager;
  const repo = {
    transaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    snapshot: jest.fn(),
    renew: jest.fn(),
    lockSection: jest.fn(),
    owned: jest.fn(),
    saveMediaResult: jest.fn(),
    clearCurrent: jest.fn(),
    saveAttempt: jest.fn(),
    findAttempt: jest.fn(),
    mediaResults: jest.fn(),
  };
  const text = { enhance: jest.fn() };
  const documents = { enhance: jest.fn() };
  const images = { enhance: jest.fn() };
  const media = {
    saveMediaItemInTransaction: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };
  const s3 = { upload: jest.fn(), delete: jest.fn() };
  let service: ProcessIdeaAiEnhancementService;
  beforeEach(async () => {
    jest.resetAllMocks();
    repo.transaction.mockImplementation((run) => run(manager));
    repo.snapshot.mockResolvedValue(snapshot);
    repo.renew.mockResolvedValue(true);
    repo.lockSection.mockResolvedValue(section);
    repo.owned.mockResolvedValue(attempt);
    repo.mediaResults.mockResolvedValue([]);
    text.enhance.mockResolvedValue({
      title: 'Gincana revisada',
      description: section.description,
      guard: { approved: true, violations: [] },
    });
    documents.enhance.mockResolvedValue({
      sourceMediaId: source.id,
      status: IdeaAiMediaStatus.ENHANCED,
      artifact: {
        buffer: Buffer.from('PDF'),
        name: 'new.pdf',
        mimeType: 'application/pdf',
      },
    });
    media.saveMediaItemInTransaction.mockResolvedValue({ id: 'improved' });
    s3.upload.mockResolvedValue('https://bucket/improved.pdf');
    const module = await Test.createTestingModule({
      providers: [
        ProcessIdeaAiEnhancementService,
        { provide: IdeasSectionAiRepository, useValue: repo },
        {
          provide: GetAiProviderSettingsService,
          useValue: {
            getInternalSettings: jest
              .fn()
              .mockImplementation(() => structuredClone(settings)),
          },
        },
        { provide: EnhanceIdeaTextService, useValue: text },
        { provide: EnhanceIdeaDocumentService, useValue: documents },
        { provide: EnhanceIdeaImageService, useValue: images },
        { provide: MediaItemProcessor, useValue: media },
        { provide: AwsS3Service, useValue: s3 },
      ],
    }).compile();
    service = module.get(ProcessIdeaAiEnhancementService);
  });
  it('completes from immutable original without reading the auto flag', async () => {
    const original = JSON.stringify(snapshot);
    await service.process(attempt, 'owner');
    expect(text.enhance).toHaveBeenCalledWith(
      expect.anything(),
      snapshot.submittedTitle,
      snapshot.submittedDescription,
      null,
    );
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IdeaAiEnhancementStatus.COMPLETED,
        currentResultSectionId: section.id,
        activeSectionId: null,
      }),
      manager,
    );
    expect(JSON.stringify(snapshot)).toBe(original);
  });
  it('promotes a partial result when one media fails', async () => {
    documents.enhance.mockRejectedValue(new Error('provider'));
    await service.process(attempt, 'owner');
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: IdeaAiEnhancementStatus.PARTIAL }),
      manager,
    );
  });
  it('keeps the previous current result if all enhancement fails', async () => {
    text.enhance.mockRejectedValue(new Error('provider'));
    documents.enhance.mockRejectedValue(new Error('provider'));
    await service.process(attempt, 'owner');
    expect(repo.clearCurrent).not.toHaveBeenCalled();
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: IdeaAiEnhancementStatus.FAILED }),
      manager,
    );
  });
  it('discards late results after cancellation, without saving or promoting them', async () => {
    repo.owned.mockResolvedValue(null);
    await service.process(attempt, 'old-owner');
    expect(repo.saveMediaResult).not.toHaveBeenCalled();
    expect(repo.clearCurrent).not.toHaveBeenCalled();
    expect(media.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://bucket/improved.pdf'],
      expect.any(Function),
    );
  });
  it('handles deletion while processing without recreating the idea', async () => {
    repo.lockSection.mockResolvedValue(null);
    await service.process(attempt, 'owner');
    expect(repo.saveAttempt).not.toHaveBeenCalled();
    expect(media.discardUnreferencedUploads).toHaveBeenCalled();
  });
  it('stops on lease loss and never publishes video output', async () => {
    repo.renew.mockResolvedValue(false);
    await service.process(attempt, 'owner');
    expect(documents.enhance).not.toHaveBeenCalled();
    repo.renew.mockResolvedValue(true);
    repo.snapshot.mockResolvedValue({
      ...snapshot,
      medias: [
        {
          ...snapshot.medias[0],
          sourceMedia: { ...source, mediaType: MediaType.VIDEO },
        },
      ],
    });
    await service.process(attempt, 'new-owner');
    expect(documents.enhance).not.toHaveBeenCalled();
    expect(images.enhance).not.toHaveBeenCalled();
    expect(repo.saveMediaResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IdeaAiMediaStatus.SKIPPED,
        enhancedMediaId: null,
      }),
      manager,
    );
  });
  it('cleans uploaded artifacts when result persistence rolls back', async () => {
    repo.saveMediaResult.mockRejectedValue(new Error('database'));
    await service.process(attempt, 'owner');
    expect(media.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://bucket/improved.pdf'],
      expect.any(Function),
    );
  });
});
