import { EntityManager } from 'typeorm';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { CreateIdeaSnapshotService } from './create-idea-snapshot.service';
import { source, section, snapshot } from '../testing/fixtures';
import { IdeaSubmissionSnapshotSource } from '../enums/ideas-section-ai.enums';
describe('immutable submission snapshot', () => {
  it('creates separate source rows in the same transaction without copying S3', async () => {
    const manager = {} as EntityManager;
    const repo = {
      snapshot: jest.fn().mockResolvedValue(null),
      saveSnapshot: jest.fn().mockResolvedValue(snapshot),
    };
    const media = {
      saveMediaItemInTransaction: jest
        .fn()
        .mockResolvedValue({ ...source, id: 'immutable' }),
    };
    const service = new CreateIdeaSnapshotService(
      repo as unknown as IdeasSectionAiRepository,
      media as unknown as MediaItemProcessor,
    );
    await service.capture(
      section,
      [source],
      manager,
      IdeaSubmissionSnapshotSource.SUBMISSION,
    );
    expect(media.saveMediaItemInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        url: source.url,
        targetType: MediaTargetType.IdeasSectionSubmissionSource,
      }),
    );
    expect(repo.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedTitle: section.title,
        source: IdeaSubmissionSnapshotSource.SUBMISSION,
        medias: [expect.objectContaining({ sourceMediaId: 'immutable' })],
      }),
      manager,
    );
    repo.snapshot.mockResolvedValue(snapshot);
    await service.capture({ ...section, title: 'edited' }, [], manager);
    expect(repo.saveSnapshot).toHaveBeenCalledTimes(1);
  });
});
