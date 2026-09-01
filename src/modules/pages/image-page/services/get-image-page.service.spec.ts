import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
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

const buildMedia = (id: string, targetId: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    title: id,
    description: '',
    mediaType: MediaType.IMAGE,
    uploadType: UploadType.LINK,
    url: 'https://example.com/a.png',
    isLocalFile: false,
    targetId,
    targetType: 'ImagesPage',
  });

describe('ImagePageGetService', () => {
  const imagePageRepository = {
    findAllWithSections: jest.fn(),
    findByIdWithSections: jest.fn(),
    findById: jest.fn(),
    findSectionsPaginated: jest.fn(),
  };
  const mediaItemProcessor = { findManyMediaItemsByTargets: jest.fn() };

  let service: ImagePageGetService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagePageGetService,
        { provide: ImagePageRepository, useValue: imagePageRepository },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(ImagePageGetService);
  });

  describe('findAll', () => {
    it('carrega as mídias de todas as seções em uma consulta', async () => {
      imagePageRepository.findAllWithSections.mockResolvedValue([
        buildPage('a'),
        buildPage('b'),
      ]);
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
        buildMedia('m1', 'a-s1'),
      ]);

      const result = await service.findAll();

      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).toHaveBeenCalledTimes(1);
      expect(result[0].sections[0].mediaItems).toHaveLength(1);
      expect(result[1].sections[0].mediaItems).toHaveLength(0);
    });

    it('omite galeria sem rota em vez de derrubar a listagem', async () => {
      const orphan = buildPage('sem-rota', { route: undefined as never });
      imagePageRepository.findAllWithSections.mockResolvedValue([
        buildPage('a'),
        orphan,
      ]);

      const result = await service.findAll();

      expect(result.map((page) => page.id)).toEqual(['a']);
    });

    it('não consulta mídia quando não há galeria', async () => {
      imagePageRepository.findAllWithSections.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual([]);
      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).not.toHaveBeenCalled();
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

    it('falha quando a galeria não existe', async () => {
      imagePageRepository.findById.mockResolvedValue(null);

      await expect(
        service.findSectionsPaginated('x', query, false),
      ).rejects.toBeInstanceOf(AppNotFoundException);
    });
  });
});
