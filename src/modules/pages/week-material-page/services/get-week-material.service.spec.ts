import { Test } from '@nestjs/testing';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { AppNotFoundException } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { WeekMaterialsPageRepository } from '../repositories/week-material-page.repository';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { WeekMaterialsPageGetService } from './get-week-material.service';

const buildPage = (id: string): WeekMaterialsPageEntity =>
  Object.assign(new WeekMaterialsPageEntity(), {
    id,
    title: `Semana ${id}`,
    subtitle: 'Tema',
    description: 'Descrição',
    currentWeek: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    route: {
      id: `route-${id}`,
      path: `materiais_semanal_${id}`,
      title: `Semana ${id}`,
      subtitle: 'Tema',
      description: 'Descrição',
      type: RouteType.PAGE,
      public: true,
    },
  });

const buildMedia = (id: string, targetId: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    title: id,
    description: '',
    mediaType: MediaType.VIDEO,
    uploadType: UploadType.LINK,
    url: 'https://example.com',
    isLocalFile: false,
    targetId,
    targetType: 'WeekMaterialsPage',
  });

describe('WeekMaterialsPageGetService', () => {
  const pageRepo = {
    findAllPaginated: jest.fn(),
    findOnePageById: jest.fn(),
    findCurrentWeek: jest.fn(),
  };
  const mediaItemProcessor = {
    findMediaItemsByTarget: jest.fn(),
    findManyMediaItemsByTargets: jest.fn(),
  };

  let service: WeekMaterialsPageGetService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WeekMaterialsPageGetService,
        { provide: WeekMaterialsPageRepository, useValue: pageRepo },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(WeekMaterialsPageGetService);
  });

  describe('findOnePage', () => {
    it('returns the page found by the repository', async () => {
      const page = buildPage('a');
      pageRepo.findOnePageById.mockResolvedValue(page);

      await expect(service.findOnePage('a')).resolves.toBe(page);
    });

    it('fails with the documented not-found error', async () => {
      pageRepo.findOnePageById.mockResolvedValue(null);

      await expect(service.findOnePage('missing')).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
    });
  });

  describe('findPageWithMedia', () => {
    it('maps the page together with its media', async () => {
      pageRepo.findOnePageById.mockResolvedValue(buildPage('a'));
      mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([
        buildMedia('v1', 'a'),
      ]);

      const result = await service.findPageWithMedia('a');

      expect(result.id).toBe('a');
      expect(result.videos.map((i) => i.id)).toEqual(['v1']);
    });
  });

  describe('findAllPaginated', () => {
    it('conta as mídias de toda a página em uma consulta', async () => {
      pageRepo.findAllPaginated.mockResolvedValue({
        items: [buildPage('a'), buildPage('b')],
        total: 2,
      });
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
        buildMedia('v1', 'a'),
        buildMedia('v2', 'b'),
        buildMedia('v3', 'a'),
      ]);

      const result = await service.findAllPaginated({ page: 1, limit: 12 });

      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).toHaveBeenCalledTimes(1);
      expect(result.data[0].videoCount).toBe(2);
      expect(result.data[1].videoCount).toBe(1);
    });

    it('mantém a página sem rota na listagem, com routePath nulo', async () => {
      const orphan = buildPage('sem-rota');
      orphan.route = undefined as never;
      pageRepo.findAllPaginated.mockResolvedValue({
        items: [buildPage('a'), orphan],
        total: 2,
      });
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

      const result = await service.findAllPaginated({});

      expect(result.data.map((page) => page.id)).toEqual(['a', 'sem-rota']);
      expect(result.data[1].routePath).toBeNull();
    });

    it('devolve o envelope paginado com o total do banco', async () => {
      pageRepo.findAllPaginated.mockResolvedValue({ items: [], total: 25 });

      const result = await service.findAllPaginated({ page: 2, limit: 12 });

      expect(result).toEqual({
        data: [],
        total: 25,
        page: 2,
        limit: 12,
        pageCount: 3,
      });
    });

    it('não consulta mídia quando a página está vazia', async () => {
      pageRepo.findAllPaginated.mockResolvedValue({ items: [], total: 0 });

      await service.findAllPaginated({});

      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).not.toHaveBeenCalled();
    });

    it('zera as contagens de uma página sem mídia', async () => {
      pageRepo.findAllPaginated.mockResolvedValue({
        items: [buildPage('a')],
        total: 1,
      });
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

      const { data } = await service.findAllPaginated({});

      expect(data[0]).toMatchObject({
        videoCount: 0,
        documentCount: 0,
        imageCount: 0,
        audioCount: 0,
      });
    });
  });

  describe('getCurrentWeek', () => {
    it('returns the published page with its media', async () => {
      pageRepo.findCurrentWeek.mockResolvedValue(buildPage('a'));
      mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([
        buildMedia('v1', 'a'),
      ]);

      const result = await service.getCurrentWeek();

      expect(result?.id).toBe('a');
    });

    it('returns null when no page is published', async () => {
      pageRepo.findCurrentWeek.mockResolvedValue(null);

      await expect(service.getCurrentWeek()).resolves.toBeNull();
      expect(mediaItemProcessor.findMediaItemsByTarget).not.toHaveBeenCalled();
    });
  });
});
