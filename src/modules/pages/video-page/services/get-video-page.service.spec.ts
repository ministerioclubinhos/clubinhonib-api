import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { VideosPage } from '../entities/video-page.entity';
import { GetVideosPageService } from './get-video-page.service';

const buildPage = (
  id: string,
  overrides: Partial<VideosPage> = {},
): VideosPage =>
  Object.assign(new VideosPage(), {
    id,
    name: `Galeria ${id}`,
    description: '',
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    route: {
      id: `route-${id}`,
      title: `Galeria ${id}`,
      subtitle: '',
      public: true,
      image: '',
      idToFetch: id,
      path: `galeria_videos_${id}`,
      entityType: 'VideosPage',
      description: '',
      entityId: id,
      type: RouteType.PAGE,
    },
    ...overrides,
  });

const buildVideo = (id: string, targetId: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    title: id,
    description: '',
    mediaType: MediaType.VIDEO,
    uploadType: UploadType.LINK,
    url: 'https://youtube.com/embed/a',
    isLocalFile: false,
    targetId,
    targetType: 'VideosPage',
  });

describe('GetVideosPageService', () => {
  const videosPageRepo = { findAll: jest.fn(), findById: jest.fn() };
  const mediaItemProcessor = {
    findMediaItemsByTarget: jest.fn(),
    findManyMediaItemsByTargets: jest.fn(),
  };

  let service: GetVideosPageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetVideosPageService,
        { provide: VideosPageRepository, useValue: videosPageRepo },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(GetVideosPageService);
  });

  describe('findAll', () => {
    it('carrega os vídeos de todas as páginas em uma consulta', async () => {
      videosPageRepo.findAll.mockResolvedValue([
        buildPage('a'),
        buildPage('b'),
      ]);
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
        buildVideo('v1', 'a'),
        buildVideo('v2', 'a'),
      ]);

      const result = await service.findAll();

      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).toHaveBeenCalledTimes(1);
      expect(result[0].videos).toHaveLength(2);
      expect(result[1].videos).toHaveLength(0);
    });

    it('omite página sem rota em vez de derrubar a listagem', async () => {
      videosPageRepo.findAll.mockResolvedValue([
        buildPage('a'),
        buildPage('sem-rota', { route: undefined as never }),
      ]);
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.map((page) => page.id)).toEqual(['a']);
    });

    it('não consulta mídia quando não há página', async () => {
      videosPageRepo.findAll.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual([]);
      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('devolve a página com seus vídeos', async () => {
      videosPageRepo.findById.mockResolvedValue(buildPage('a'));
      mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([
        buildVideo('v1', 'a'),
      ]);

      const result = await service.findOne('a');

      expect(result.id).toBe('a');
      expect(result.videos).toHaveLength(1);
    });

    it('falha com o erro documentado quando não existe', async () => {
      videosPageRepo.findById.mockResolvedValue(null);

      await expect(service.findOne('x')).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
    });
  });
});
