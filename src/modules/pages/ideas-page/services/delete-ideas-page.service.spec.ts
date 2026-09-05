import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DeleteRouteService } from 'src/modules/routes/services/delete-route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import { IdeasPageGetService } from './get-ideas-page.service';
import { IdeasPageDeleteService } from './delete-ideas-page.service';

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
  Object.assign(new IdeasSectionEntity(), { id, title: id, description: '' });

const buildPage = (
  sections: IdeasSectionEntity[] = [],
  withRoute = true,
): IdeasPageEntity =>
  Object.assign(new IdeasPageEntity(), {
    id: 'page-id',
    title: 'Ideias',
    description: '',
    public: false,
    sections,
    route: withRoute ? route : null,
  });

describe('IdeasPageDeleteService', () => {
  const manager = {} as EntityManager;
  // A transação passou a ser aberta pelo repositório: o caso de uso entrega
  // o bloco de escritas e não conhece mais `DataSource`.
  const ideasPageRepository = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    removePage: jest.fn(),
  };
  const getService = { findEntityOrFail: jest.fn() };
  const deleteRouteService = {
    removeRoute: jest.fn(),
    removeRouteByEntity: jest.fn(),
  };
  const awsS3Service = { delete: jest.fn() };
  const mediaItemProcessor = {
    findManyMediaItemsByTargets: jest.fn(),
    deleteMediaItems: jest.fn(),
  };

  let service: IdeasPageDeleteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getService.findEntityOrFail.mockResolvedValue(buildPage());
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        IdeasPageDeleteService,
        { provide: IdeasPageRepository, useValue: ideasPageRepository },
        { provide: IdeasPageGetService, useValue: getService },
        { provide: DeleteRouteService, useValue: deleteRouteService },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(IdeasPageDeleteService);
  });

  it('remove mídias das seções, a página e depois a rota', async () => {
    const media = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      isLocalFile: true,
      url: 'https://s3/a.png',
    });
    getService.findEntityOrFail.mockResolvedValue(
      buildPage([buildSection('s1')]),
    );
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([media]);

    await service.removePage('page-id');

    expect(mediaItemProcessor.findManyMediaItemsByTargets).toHaveBeenCalledWith(
      ['s1'],
      'IdeasSection',
    );
    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [media],
      expect.any(Function),
    );
    expect(ideasPageRepository.removePage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'page-id' }),
      manager,
    );
    expect(deleteRouteService.removeRoute).toHaveBeenCalledWith('route-id');
  });

  it('remove a rota pela entidade quando a página não a carrega', async () => {
    getService.findEntityOrFail.mockResolvedValue(buildPage([], false));

    await service.removePage('page-id');

    expect(deleteRouteService.removeRouteByEntity).toHaveBeenCalledWith(
      'IdeasPage',
      'page-id',
    );
  });

  it('não consulta mídias quando a página não tem seções', async () => {
    await service.removePage('page-id');

    expect(
      mediaItemProcessor.findManyMediaItemsByTargets,
    ).not.toHaveBeenCalled();
  });

  it('propaga o not found de uma página inexistente', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Página de ideias não encontrada.',
    );
    getService.findEntityOrFail.mockRejectedValue(notFound);

    await expect(service.removePage('x')).rejects.toBe(notFound);
  });

  it('embrulha falha inesperada de persistência', async () => {
    ideasPageRepository.removePage.mockRejectedValue(new Error('db down'));

    await expect(service.removePage('page-id')).rejects.toBeInstanceOf(
      AppInternalException,
    );
  });
});
