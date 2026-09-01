import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import { IdeasPageGetService } from './get-ideas-page.service';

const route = {
  id: 'route-id',
  title: 'Ideias',
  subtitle: '',
  public: false,
  current: false,
  image: '',
  idToFetch: 'page-id',
  path: 'galeria_ideias_ideias',
  entityType: 'IdeasPage',
  description: '',
  entityId: 'page-id',
  type: RouteType.PAGE,
};

const buildSection = (id: string): IdeasSectionEntity =>
  Object.assign(new IdeasSectionEntity(), {
    id,
    title: `Seção ${id}`,
    description: '',
    public: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const buildPage = (
  id: string,
  sections: IdeasSectionEntity[] = [],
  withRoute = true,
): IdeasPageEntity =>
  Object.assign(new IdeasPageEntity(), {
    id,
    title: 'Ideias',
    subtitle: '',
    description: 'Descrição',
    public: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sections,
    route: withRoute ? { ...route, idToFetch: id, entityId: id } : null,
  });

describe('IdeasPageGetService', () => {
  const ideasPageRepository = {
    findAllWithSections: jest.fn(),
    findByIdWithSections: jest.fn(),
  };
  const mediaItemProcessor = { findManyMediaItemsByTargets: jest.fn() };

  let service: IdeasPageGetService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        IdeasPageGetService,
        { provide: IdeasPageRepository, useValue: ideasPageRepository },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(IdeasPageGetService);
  });

  it('devolve a página com as mídias agrupadas por seção', async () => {
    ideasPageRepository.findByIdWithSections.mockResolvedValue(
      buildPage('page-id', [buildSection('s1'), buildSection('s2')]),
    );
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
      Object.assign(new MediaItemEntity(), {
        id: 'm1',
        targetId: 's2',
        url: 'https://s3/a.png',
        isLocalFile: true,
      }),
    ]);

    const result = await service.findOne('page-id');

    expect(mediaItemProcessor.findManyMediaItemsByTargets).toHaveBeenCalledWith(
      ['s1', 's2'],
      'IdeasSection',
    );
    expect(result.sections[0].medias).toHaveLength(0);
    expect(result.sections[1].medias).toHaveLength(1);
  });

  it('falha quando a página não existe', async () => {
    ideasPageRepository.findByIdWithSections.mockResolvedValue(null);

    await expect(service.findOne('x')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  it('omite da listagem a página sem rota, sem derrubar as demais', async () => {
    ideasPageRepository.findAllWithSections.mockResolvedValue([
      buildPage('ok'),
      buildPage('orfa', [], false),
    ]);

    const result = await service.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ok');
  });

  it('não consulta mídias quando não há seções', async () => {
    const result = await service.findMediaOfSections([]);

    expect(result.size).toBe(0);
    expect(
      mediaItemProcessor.findManyMediaItemsByTargets,
    ).not.toHaveBeenCalled();
  });
});
