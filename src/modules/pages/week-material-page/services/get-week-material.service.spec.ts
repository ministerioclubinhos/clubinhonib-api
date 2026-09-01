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
    findAllPages: jest.fn(),
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

  describe('findAllPagesWithMedia', () => {
    it('loads media in a single query and groups it per page', async () => {
      pageRepo.findAllPages.mockResolvedValue([buildPage('a'), buildPage('b')]);
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
        buildMedia('v1', 'a'),
        buildMedia('v2', 'b'),
        buildMedia('v3', 'a'),
      ]);

      const result = await service.findAllPagesWithMedia();

      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).toHaveBeenCalledTimes(1);
      expect(result[0].videos.map((i) => i.id)).toEqual(['v1', 'v3']);
      expect(result[1].videos.map((i) => i.id)).toEqual(['v2']);
    });

    it('omite página sem rota em vez de derrubar a listagem', async () => {
      const orphan = buildPage('sem-rota');
      orphan.route = undefined as never;
      pageRepo.findAllPages.mockResolvedValue([buildPage('a'), orphan]);
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

      const result = await service.findAllPagesWithMedia();

      expect(result.map((page) => page.id)).toEqual(['a']);
      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).toHaveBeenCalledWith(['a'], 'WeekMaterialsPage');
    });

    it('retorna vazio quando todas as páginas estão sem rota', async () => {
      const orphan = buildPage('sem-rota');
      orphan.route = undefined as never;
      pageRepo.findAllPages.mockResolvedValue([orphan]);

      await expect(service.findAllPagesWithMedia()).resolves.toEqual([]);
      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).not.toHaveBeenCalled();
    });

    it('does not query media when there is no page', async () => {
      pageRepo.findAllPages.mockResolvedValue([]);

      await expect(service.findAllPagesWithMedia()).resolves.toEqual([]);
      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).not.toHaveBeenCalled();
    });

    it('returns empty media groups for a page without media', async () => {
      pageRepo.findAllPages.mockResolvedValue([buildPage('a')]);
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

      const [result] = await service.findAllPagesWithMedia();

      expect(result.videos).toEqual([]);
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
