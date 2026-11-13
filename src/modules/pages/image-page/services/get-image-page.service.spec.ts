import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { ImageSectionCelebrationsRepository } from '../repositories/image-section-celebrations.repository';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { QueryImageSectionsDto } from '../dto/query-image-sections.dto';
import { ImagePageGetService } from './get-image-page.service';

const buildSection = (id: string): ImageSectionEntity =>
  Object.assign(new ImageSectionEntity(), {
    id,
    caption: `Seção ${id}`,
    description: '',
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const buildPage = (
  id: string,
  overrides: Partial<ImagePageEntity> = {},
): ImagePageEntity =>
  Object.assign(new ImagePageEntity(), {
    id,
    name: `Galeria ${id}`,
    description: '',
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    sections: [buildSection(`${id}-s1`)],
    route: {
      id: `route-${id}`,
      title: `Galeria ${id}`,
      subtitle: '',
      public: true,
      image: '',
      idToFetch: id,
      path: `galeria_imagens_${id}`,
      entityType: 'ImagesPage',
      description: '',
      entityId: id,
      type: RouteType.PAGE,
    },
    ...overrides,
  });

describe('ImagePageGetService', () => {
  const imagePageRepository = {
    findAllPaginated: jest.fn(),
    findByIdWithSections: jest.fn(),
    findById: jest.fn(),
    findSectionsPaginated: jest.fn(),
  };
  const mediaItemProcessor = { findManyMediaItemsByTargets: jest.fn() };
  const celebrations = { findBySections: jest.fn() };

  let service: ImagePageGetService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);
    celebrations.findBySections.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagePageGetService,
        { provide: ImagePageRepository, useValue: imagePageRepository },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        {
          provide: ImageSectionCelebrationsRepository,
          useValue: celebrations,
        },
      ],
    }).compile();

    service = moduleRef.get(ImagePageGetService);
  });

  describe('findAllPaginated', () => {
    it('resume a galeria sem carregar seções nem mídias', async () => {
      const page = buildPage('a');
      page.sectionCount = 3;
      imagePageRepository.findAllPaginated.mockResolvedValue({
        items: [page],
        total: 1,
      });

      const result = await service.findAllPaginated({ page: 1, limit: 12 });

      expect(result.data[0]).toEqual({
        id: 'a',
        title: page.name,
        description: page.description,
        public: page.public,
        routePath: page.route.path,
        sectionCount: 3,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
      });
      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).not.toHaveBeenCalled();
    });

    it('mantém a galeria sem rota na listagem, com routePath nulo', async () => {
      const orphan = buildPage('sem-rota', { route: undefined as never });
      imagePageRepository.findAllPaginated.mockResolvedValue({
        items: [buildPage('a'), orphan],
        total: 2,
      });

      const result = await service.findAllPaginated({});

      expect(result.data.map((item) => item.id)).toEqual(['a', 'sem-rota']);
      expect(result.data[1].routePath).toBeNull();
    });

    it('devolve o envelope paginado com o total do banco', async () => {
      imagePageRepository.findAllPaginated.mockResolvedValue({
        items: [],
        total: 30,
      });

      const result = await service.findAllPaginated({ page: 3, limit: 12 });

      expect(result).toEqual({
        data: [],
        total: 30,
        page: 3,
        limit: 12,
        pageCount: 3,
      });
    });
  });

  describe('findOne', () => {
    it('falha com o erro documentado quando a galeria não existe', async () => {
      imagePageRepository.findByIdWithSections.mockResolvedValue(null);

      await expect(service.findOne('x')).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
    });
  });

  describe('findSectionsPaginated', () => {
    const query = Object.assign(new QueryImageSectionsDto(), {
      page: 2,
      limit: 3,
    });

    beforeEach(() => {
      imagePageRepository.findById.mockResolvedValue(buildPage('a'));
      imagePageRepository.findSectionsPaginated.mockResolvedValue([
        [buildSection('s1')],
        10,
      ]);
    });

    it('calcula o offset a partir da página e do limite', async () => {
      await service.findSectionsPaginated('a', query, false);

      expect(imagePageRepository.findSectionsPaginated).toHaveBeenCalledWith(
        'a',
        3,
        3,
        false,
      );
    });

    it('repassa a visibilidade decidida pelo controller', async () => {
      await service.findSectionsPaginated('a', query, true);

      expect(imagePageRepository.findSectionsPaginated).toHaveBeenCalledWith(
        'a',
        3,
        3,
        true,
      );
    });

    it('devolve o total e a página consultada', async () => {
      const result = await service.findSectionsPaginated('a', query, false);

      expect(result).toMatchObject({ page: 2, limit: 3, total: 10 });
      expect(result.sections).toHaveLength(1);
    });

    it('soma as celebrações da página em uma única consulta', async () => {
      celebrations.findBySections.mockResolvedValue([
        { sectionId: 's1', userId: 'u1', userName: 'Ana' },
        { sectionId: 's1', userId: 'me', userName: 'Eu' },
      ]);

      const result = await service.findSectionsPaginated(
        'a',
        query,
        false,
        'me',
      );

      expect(celebrations.findBySections).toHaveBeenCalledTimes(1);
      expect(celebrations.findBySections).toHaveBeenCalledWith(['s1']);
      expect(result.sections[0]).toMatchObject({
        celebrationCount: 2,
        celebrators: ['Ana', 'Eu'],
        celebratedByMe: true,
      });
    });

    it('sem celebração, a seção vem zerada', async () => {
      const result = await service.findSectionsPaginated('a', query, false);

      expect(result.sections[0]).toMatchObject({
        celebrationCount: 0,
        celebrators: [],
        celebratedByMe: false,
      });
    });

    it('falha quando a galeria não existe', async () => {
      imagePageRepository.findById.mockResolvedValue(null);

      await expect(
        service.findSectionsPaginated('x', query, false),
      ).rejects.toBeInstanceOf(AppNotFoundException);
    });
  });
});
