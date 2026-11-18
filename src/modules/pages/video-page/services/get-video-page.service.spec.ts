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
  const videosPageRepo = { findAllPaginated: jest.fn(), findById: jest.fn() };
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

  describe('findAllPaginated', () => {
    it('conta os vídeos de toda a página em uma consulta', async () => {
      videosPageRepo.findAllPaginated.mockResolvedValue({
        items: [buildPage('a'), buildPage('b')],
        total: 2,
      });
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
        buildVideo('v1', 'a'),
        buildVideo('v2', 'a'),
      ]);

      const result = await service.findAllPaginated({ page: 1, limit: 12 });

      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).toHaveBeenCalledTimes(1);
      expect(result.data[0].videoCount).toBe(2);
      expect(result.data[1].videoCount).toBe(0);
    });

    it('mantém a página sem rota na listagem, com routePath nulo', async () => {
      videosPageRepo.findAllPaginated.mockResolvedValue({
        items: [
          buildPage('a'),
          buildPage('sem-rota', { route: undefined as never }),
        ],
        total: 2,
      });
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

      const result = await service.findAllPaginated({});

      expect(result.data.map((page) => page.id)).toEqual(['a', 'sem-rota']);
      expect(result.data[1].routePath).toBeNull();
    });

    it('não consulta mídia quando a página está vazia', async () => {
      videosPageRepo.findAllPaginated.mockResolvedValue({
        items: [],
        total: 0,
      });

      await expect(service.findAllPaginated({})).resolves.toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 12,
        pageCount: 0,
      });
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
