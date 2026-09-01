import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { WeekMaterialsPageRepository } from '../repositories/week-material-page.repository';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { WeekMaterialsPageGetService } from './get-week-material.service';
import { WeekMaterialsPageRemoveService } from './delete-week-material.service';

const buildPage = (
  overrides: Partial<WeekMaterialsPageEntity> = {},
): WeekMaterialsPageEntity =>
  Object.assign(new WeekMaterialsPageEntity(), {
    id: 'page-id',
    title: 'Semana 1',
    subtitle: 'Tema',
    description: 'Descrição',
    currentWeek: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    route: {
      id: 'route-id',
      path: 'materiais_semanal_semana_1',
      title: 'Semana 1',
      subtitle: 'Tema',
      description: 'Descrição',
      type: RouteType.PAGE,
      public: true,
    },
    ...overrides,
  });

describe('WeekMaterialsPageRemoveService', () => {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      (runInTransaction: (m: EntityManager) => Promise<unknown>) =>
        runInTransaction(manager),
    ),
  };
  const pageRepo = { removePage: jest.fn() };
  const getService = { findOnePage: jest.fn(), findMediaOfPage: jest.fn() };
  const s3 = { delete: jest.fn() };
  const routeService = {
    removeRoute: jest.fn(),
    removeRouteByEntity: jest.fn(),
  };
  const mediaItemProcessor = { deleteMediaItems: jest.fn() };

  let service: WeekMaterialsPageRemoveService;

  beforeEach(async () => {
    jest.clearAllMocks();

    getService.findOnePage.mockResolvedValue(buildPage());
    getService.findMediaOfPage.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        WeekMaterialsPageRemoveService,
        { provide: DataSource, useValue: dataSource },
        { provide: WeekMaterialsPageRepository, useValue: pageRepo },
        { provide: WeekMaterialsPageGetService, useValue: getService },
        { provide: AwsS3Service, useValue: s3 },
        { provide: RouteService, useValue: routeService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(WeekMaterialsPageRemoveService);
  });

  it('removes media, page and route', async () => {
    const media = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      mediaType: MediaType.VIDEO,
      uploadType: UploadType.UPLOAD,
      isLocalFile: true,
      url: 'https://s3/file.mp4',
    });
    getService.findMediaOfPage.mockResolvedValue([media]);

    await service.removeWeekMaterial('page-id');

    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [media],
      expect.any(Function),
    );
    expect(pageRepo.removePage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'page-id' }),
      manager,
    );
    expect(routeService.removeRoute).toHaveBeenCalledWith('route-id');
  });

  it('skips media deletion when the page has none', async () => {
    await service.removeWeekMaterial('page-id');

    expect(mediaItemProcessor.deleteMediaItems).not.toHaveBeenCalled();
    expect(pageRepo.removePage).toHaveBeenCalledTimes(1);
  });

  it('falls back to the entity lookup when the page has no route relation', async () => {
    getService.findOnePage.mockResolvedValue(
      buildPage({ route: undefined as never }),
    );

    await service.removeWeekMaterial('page-id');

    expect(routeService.removeRoute).not.toHaveBeenCalled();
    expect(routeService.removeRouteByEntity).toHaveBeenCalledWith(
      'WeekMaterialsPage',
      'page-id',
    );
  });

  it('propagates the not-found error of an unknown page', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.WEEK_MATERIAL_NOT_FOUND,
      'Página não encontrada',
    );
    getService.findOnePage.mockRejectedValue(notFound);

    await expect(service.removeWeekMaterial('missing')).rejects.toBe(notFound);
  });

  it('wraps an unexpected persistence failure', async () => {
    pageRepo.removePage.mockRejectedValue(new Error('db down'));

    await expect(service.removeWeekMaterial('page-id')).rejects.toBeInstanceOf(
      AppInternalException,
    );
  });
});
