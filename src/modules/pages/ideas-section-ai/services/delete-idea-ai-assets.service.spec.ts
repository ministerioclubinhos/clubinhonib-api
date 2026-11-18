import { EntityManager } from 'typeorm';
import { DeleteIdeaAiAssetsService } from './delete-idea-ai-assets.service';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
it('fences jobs, deletes referencing history before sources, and returns local URLs for post-commit cleanup', async () => {
  const manager = {} as EntityManager;
  const repo = { lockSection: jest.fn(), deleteHistory: jest.fn() };
  const media = {
    findMediaItemsByTargetInTransaction: jest
      .fn()
      .mockResolvedValueOnce([
        { url: 'original', isLocalFile: true },
        { url: 'youtube', isLocalFile: false },
      ])
      .mockResolvedValueOnce([{ url: 'enhanced', isLocalFile: true }]),
    deleteMediaItemsByTargetInTransaction: jest.fn(),
  };
  const service = new DeleteIdeaAiAssetsService(
    repo as unknown as IdeasSectionAiRepository,
    media as unknown as MediaItemProcessor,
  );
  await expect(service.remove('section', manager)).resolves.toEqual([
    'original',
    'enhanced',
  ]);
  expect(repo.deleteHistory.mock.invocationCallOrder[0]).toBeLessThan(
    media.deleteMediaItemsByTargetInTransaction.mock.invocationCallOrder[0],
  );
  expect(media.deleteMediaItemsByTargetInTransaction).toHaveBeenCalledWith(
    manager,
    'section',
    MediaTargetType.IdeasSectionSubmissionSource,
  );
  expect(media.deleteMediaItemsByTargetInTransaction).toHaveBeenCalledWith(
    manager,
    'section',
    MediaTargetType.IdeasSectionAiEnhancedMedia,
  );
});
