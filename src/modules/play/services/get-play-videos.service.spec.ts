import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { PlayVideoEntryRepository } from '../repositories/play-video-entry.repository';
import { PlayAccessService } from './play-access.service';
import { GetPlayVideosService } from './get-play-videos.service';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'v1',
  title: 'Vídeo',
  description: 'd',
  uploadType: 'link',
  platformType: 'youtube',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  isLocalFile: 0,
  originalName: null,
  size: null,
  galleryId: 'g1',
  galleryTitle: 'Galeria',
  featured: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  thumbnailUrl: null,
  durationSeconds: null,
  categoryId: null,
  categoryName: null,
  viewCount: '3',
  favorite: 1,
  progressPosition: 30,
  progressDuration: 200,
  progressCompleted: 0,
  ...overrides,
});

describe('GetPlayVideosService', () => {
  const repo = {
    findVideos: jest.fn(),
    findVideo: jest.fn(),
    findGalleries: jest.fn(),
    findCategoriesWithCount: jest.fn(),
    findStats: jest.fn(),
    countViews: jest.fn(),
    countVisible: jest.fn(),
  };
  const access = { assertEnabled: jest.fn() };
  let service: GetPlayVideosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    access.assertEnabled.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetPlayVideosService,
        { provide: PlayVideoEntryRepository, useValue: repo },
        { provide: PlayAccessService, useValue: access },
      ],
    }).compile();
    service = moduleRef.get(GetPlayVideosService);
  });

  it('lista paginada sem expor targetId/targetType, com miniatura do YouTube e progresso', async () => {
    repo.findVideos.mockResolvedValue({ rows: [row()], total: 25 });

    const result = await service.findAll('u1', { page: 2, limit: 12 });

    expect(result.pageCount).toBe(3);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'v1',
        featured: true,
        favorite: true,
        viewCount: 3,
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        progress: {
          positionSeconds: 30,
          durationSeconds: 200,
          completed: false,
        },
      }),
    );
    expect(result.data[0]).not.toHaveProperty('targetId');
    expect(repo.findVideos).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('propaga a recusa quando a flag está desligada', async () => {
    access.assertEnabled.mockRejectedValue(new Error('off'));

    await expect(service.findAll('u1', {})).rejects.toThrow('off');
    await expect(service.findOne('u1', 'v1')).rejects.toThrow('off');
    expect(repo.findVideos).not.toHaveBeenCalled();
  });

  it('404 para vídeo fora do Play', async () => {
    repo.findVideo.mockResolvedValue(undefined);

    await expect(service.findOne('u1', 'v1')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  it('relacionados priorizam a galeria e a categoria do vídeo atual', async () => {
    repo.findVideo.mockResolvedValue(row({ categoryId: 'c1' }));
    repo.findVideos.mockResolvedValue({ rows: [row({ id: 'v2' })], total: 1 });

    const result = await service.findRelated('u1', 'v1');

    expect(result.map((v) => v.id)).toEqual(['v2']);
    expect(repo.findVideos).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeId: 'v1',
        relatedToGalleryId: 'g1',
        relatedToCategoryId: 'c1',
      }),
    );
  });

  it('home some com as fileiras vazias e "Mais vistos" sem views', async () => {
    repo.findCategoriesWithCount.mockResolvedValue([]);
    repo.findGalleries.mockResolvedValue([]);
    repo.findVideos.mockImplementation(
      async (filters: { featured?: boolean; sort?: string }) => ({
        rows: filters.featured
          ? [row()]
          : filters.sort === 'popular'
            ? [row({ viewCount: 0 })]
            : [],
        total: 1,
      }),
    );

    const home = await service.findHome('u1');

    expect(home.sections.map((s) => s.kind)).toEqual(['featured']);
  });

  it('estatísticas somam views e convertem os números', async () => {
    repo.findStats.mockResolvedValue([
      {
        id: 'v1',
        title: 'V',
        galleryTitle: 'G',
        views: '5',
        viewers: '2',
        completed: '1',
        lastViewedAt: null,
      },
    ]);
    repo.countViews.mockResolvedValue({ views: 5, viewers: 2 });
    repo.countVisible.mockResolvedValue(4);

    const stats = await service.stats();

    expect(stats).toMatchObject({
      totalVideos: 4,
      totalViews: 5,
      totalViewers: 2,
    });
    expect(stats.videos[0]).toMatchObject({
      views: 5,
      viewers: 2,
      completed: 1,
    });
  });
});

describe('GetPlayVideosService.findQueue', () => {
  it('traz tudo de uma vez, no limite da fila, com os filtros do usuário', async () => {
    const repo = {
      findVideos: jest.fn().mockResolvedValue({ rows: [row()], total: 1 }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetPlayVideosService,
        { provide: PlayVideoEntryRepository, useValue: repo },
        { provide: PlayAccessService, useValue: { assertEnabled: jest.fn() } },
      ],
    }).compile();

    const queue = await moduleRef.get(GetPlayVideosService).findQueue('u1', {
      categoryId: 'c1',
      page: 4,
      limit: 12,
    });

    expect(queue).toHaveLength(1);
    expect(repo.findVideos).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        categoryId: 'c1',
        page: 1,
        limit: 200,
      }),
    );
  });
});
