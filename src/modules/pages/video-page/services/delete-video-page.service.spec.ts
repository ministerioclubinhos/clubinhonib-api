import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DeleteRouteService } from 'src/modules/routes/services/delete-route.service';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { VideosPage } from '../entities/video-page.entity';
import { GetVideosPageService } from './get-video-page.service';
import { DeleteVideosPageService } from './delete-video-page.service';

const page = Object.assign(new VideosPage(), {
  id: 'page-id',
  name: 'Galeria',
  description: '',
  public: true,
  route: { id: 'route-id' },
});

describe('DeleteVideosPageService', () => {
  const manager = {} as EntityManager;
  // A transação passou a ser aberta pelo repositório: o caso de uso entrega
  // o bloco de escritas e não conhece mais `DataSource`.
  const videosPageRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    removePage: jest.fn(),
  };
  const getService = { findEntityOrFail: jest.fn(), findVideosOf: jest.fn() };
  const s3 = { delete: jest.fn() };
  const deleteRouteService = {
    removeRoute: jest.fn(),
    removeRouteByEntity: jest.fn(),
  };
  const mediaItemProcessor = { deleteMediaItems: jest.fn() };

  let service: DeleteVideosPageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getService.findEntityOrFail.mockResolvedValue(page);
    getService.findVideosOf.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DeleteVideosPageService,
        { provide: VideosPageRepository, useValue: videosPageRepo },
        { provide: GetVideosPageService, useValue: getService },
        { provide: AwsS3Service, useValue: s3 },
        { provide: DeleteRouteService, useValue: deleteRouteService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(DeleteVideosPageService);
  });

  it('remove vídeos, página e rota', async () => {
    const video = Object.assign(new MediaItemEntity(), {
      id: 'v1',
      isLocalFile: true,
      url: 'https://s3/a.mp4',
    });
    getService.findVideosOf.mockResolvedValue([video]);

    await service.execute('page-id');

    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [video],
      expect.any(Function),
    );
    expect(videosPageRepo.removePage).toHaveBeenCalledWith(page, manager);
    expect(deleteRouteService.removeRoute).toHaveBeenCalledWith('route-id');
  });

  it('não chama a exclusão de mídia quando não há vídeo', async () => {
    await service.execute('page-id');

    expect(mediaItemProcessor.deleteMediaItems).not.toHaveBeenCalled();
    expect(videosPageRepo.removePage).toHaveBeenCalledTimes(1);
  });

  it('propaga o not found de uma página inexistente', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.VIDEO_NOT_FOUND,
      'Página de vídeos não encontrada.',
    );
    getService.findEntityOrFail.mockRejectedValue(notFound);

    await expect(service.execute('x')).rejects.toBe(notFound);
  });

  it('embrulha falha inesperada de persistência', async () => {
    videosPageRepo.removePage.mockRejectedValue(new Error('db down'));

    await expect(service.execute('page-id')).rejects.toBeInstanceOf(
      AppInternalException,
    );
  });
});
