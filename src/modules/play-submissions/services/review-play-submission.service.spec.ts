import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import {
  AppConflictException,
  AppNotFoundException,
  AppValidationException,
} from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { GetVideosPageService } from 'src/modules/pages/video-page/services/get-video-page.service';
import { SyncPlayEntriesService } from 'src/modules/play/services/sync-play-entries.service';
import { PlayScope } from 'src/modules/play/enums/play-scope.enum';
import { PlaySubmissionRepository } from '../repositories/play-submission.repository';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';
import { DeletePlaySubmissionService } from './delete-play-submission.service';
import { ReviewPlaySubmissionService } from './review-play-submission.service';

const manager = {} as EntityManager;
const pending = (overrides: object = {}) => ({
  id: 's1',
  title: 'T',
  description: 'd',
  uploadType: 'upload',
  platformType: null,
  url: 'https://s3/v.mp4',
  originalName: 'v.mp4',
  size: 10,
  thumbnailUrl: 'https://s3/t.jpg',
  durationSeconds: 60,
  status: PlaySubmissionStatus.PENDING,
  rejectionReason: null,
  createdAt: new Date(),
  reviewedAt: null,
  mediaItemId: null,
  ...overrides,
});

describe('ReviewPlaySubmissionService', () => {
  const repo = {
    findById: jest.fn(),
    save: jest.fn(),
    runInTransaction: jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  const galleries = { findEntityOrFail: jest.fn() };
  const media = {
    buildBaseMediaItem: jest.fn(),
    saveMediaItemInTransaction: jest.fn(),
  };
  const syncPlay = { addApproved: jest.fn() };
  const cleanup = { discardFiles: jest.fn() };
  let service: ReviewPlaySubmissionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.findById.mockResolvedValue(pending());
    repo.save.mockImplementation(async (value: object) => value);
    galleries.findEntityOrFail.mockResolvedValue({
      id: 'g1',
      playScope: PlayScope.SELECTED,
    });
    media.buildBaseMediaItem.mockImplementation((item: object) => item);
    media.saveMediaItemInTransaction.mockResolvedValue({ id: 'm1' });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewPlaySubmissionService,
        { provide: PlaySubmissionRepository, useValue: repo },
        { provide: GetVideosPageService, useValue: galleries },
        { provide: MediaItemProcessor, useValue: media },
        { provide: SyncPlayEntriesService, useValue: syncPlay },
        { provide: DeletePlaySubmissionService, useValue: cleanup },
      ],
    }).compile();
    service = moduleRef.get(ReviewPlaySubmissionService);
  });

  it('aprova criando o vídeo na galeria e no Play, na mesma transação', async () => {
    const result = await service.approve('admin1', 's1', {
      galleryId: 'g1',
      featured: true,
    });

    expect(media.buildBaseMediaItem).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'T',
        mediaType: 'video',
        isLocalFile: true,
      }),
      'g1',
      'VideosPage',
    );
    expect(syncPlay.addApproved).toHaveBeenCalledWith(
      'g1',
      'm1',
      { thumbnailUrl: 'https://s3/t.jpg', durationSeconds: 60, featured: true },
      manager,
    );
    expect(result).toMatchObject({ status: 'approved', mediaItemId: 'm1' });
    expect(cleanup.discardFiles).not.toHaveBeenCalled();
  });

  it('recusa galeria fora do Play, sem criar nada', async () => {
    galleries.findEntityOrFail.mockResolvedValue({
      id: 'g1',
      playScope: PlayScope.NONE,
    });

    await expect(
      service.approve('a', 's1', { galleryId: 'g1' }),
    ).rejects.toBeInstanceOf(AppValidationException);
    expect(media.saveMediaItemInTransaction).not.toHaveBeenCalled();
  });

  it('não decide duas vezes o mesmo envio', async () => {
    repo.findById.mockResolvedValue(
      pending({ status: PlaySubmissionStatus.APPROVED }),
    );

    await expect(
      service.approve('a', 's1', { galleryId: 'g1' }),
    ).rejects.toBeInstanceOf(AppConflictException);
    await expect(service.reject('a', 's1', {})).rejects.toBeInstanceOf(
      AppConflictException,
    );
  });

  it('404 para envio inexistente', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.reject('a', 'x', {})).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  it('reprova com motivo e apaga os arquivos do S3', async () => {
    const result = await service.reject('admin1', 's1', {
      reason: '  Fora do tema ',
    });

    expect(result).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Fora do tema',
    });
    expect(cleanup.discardFiles).toHaveBeenCalledWith([
      'https://s3/v.mp4',
      'https://s3/t.jpg',
    ]);
    expect(syncPlay.addApproved).not.toHaveBeenCalled();
  });

  it('reprovar um link não apaga nada do S3', async () => {
    repo.findById.mockResolvedValue(
      pending({
        uploadType: 'link',
        url: 'https://youtu.be/abc',
        originalName: null,
        thumbnailUrl: null,
      }),
    );

    await service.reject('admin1', 's1', {});

    expect(cleanup.discardFiles).toHaveBeenCalledWith([]);
  });
});
