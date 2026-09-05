import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { CreateRouteService } from 'src/modules/routes/services/create-route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  AppInternalException,
  AppValidationException,
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
import { CreateWeekMaterialsPageDto } from '../dto/create-week-material.dto';
import { WeekMaterialsPageCreateService } from './create-week-material.service';
import { AnnounceWeekMaterialService } from './announce-week-material.service';
import { WEEK_MATERIAL_ROUTE_PATH_PREFIX } from '../constants';

const validDto = (
  overrides: Partial<CreateWeekMaterialsPageDto> = {},
): CreateWeekMaterialsPageDto =>
  Object.assign(new CreateWeekMaterialsPageDto(), {
    pageTitle: 'Semana 1',
    pageSubtitle: 'Tema',
    pageDescription: 'Descrição',
    videos: [
      {
        title: 'Vídeo',
        description: 'Desc',
        uploadType: UploadType.LINK,
        mediaType: MediaType.VIDEO,
        isLocalFile: false,
        url: 'https://example.com/v',
      },
    ],
    ...overrides,
  });

describe('WeekMaterialsPageCreateService', () => {
  const manager = {} as EntityManager;
  // A transação passou a ser aberta pelo repositório: o caso de uso entrega
  // o bloco de escritas e não conhece mais `DataSource`.
  const pageRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    createPage: jest.fn(),
    savePage: jest.fn(),
  };
  const s3 = { upload: jest.fn(), delete: jest.fn() };
  const createRouteService = {
    generateAvailablePath: jest.fn(),
    createRouteWithManager: jest.fn(),
  };
  const announceService = { announceInBackground: jest.fn() };
  const mediaItemProcessor = {
    processMediaItemsPolymorphic: jest.fn(),
    findMediaItemsByTarget: jest.fn(),
    deleteMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: WeekMaterialsPageCreateService;

  const savedPage = (): WeekMaterialsPageEntity =>
    Object.assign(new WeekMaterialsPageEntity(), {
      id: 'page-id',
      title: 'Semana 1',
      subtitle: 'Tema',
      description: 'Descrição',
      currentWeek: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  const savedRoute = {
    id: 'route-id',
    path: 'materiais_semanal_semana_1',
    title: 'Semana 1',
    subtitle: 'Tema',
    description: 'Descrição',
    type: RouteType.PAGE,
    public: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    pageRepo.createPage.mockResolvedValue(savedPage());
    pageRepo.savePage.mockImplementation(
      (page: WeekMaterialsPageEntity) => page,
    );
    createRouteService.generateAvailablePath.mockResolvedValue(
      'materiais_semanal_semana_1',
    );
    createRouteService.createRouteWithManager.mockResolvedValue(savedRoute);
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        WeekMaterialsPageCreateService,
        { provide: WeekMaterialsPageRepository, useValue: pageRepo },
        { provide: AwsS3Service, useValue: s3 },
        { provide: CreateRouteService, useValue: createRouteService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        {
          provide: AnnounceWeekMaterialService,
          useValue: announceService,
        },
      ],
    }).compile();

    service = moduleRef.get(WeekMaterialsPageCreateService);
  });

  it('persists page, route and media inside a committed transaction', async () => {
    const media = Object.assign(new MediaItemEntity(), {
      id: 'media-id',
      title: 'Vídeo',
      description: 'Desc',
      mediaType: MediaType.VIDEO,
      uploadType: UploadType.LINK,
      url: 'https://example.com/v',
      isLocalFile: false,
      targetId: 'page-id',
      targetType: 'WeekMaterialsPage',
    });
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue([media]);

    const result = await service.createWeekMaterialsPage(validDto(), {});

    expect(createRouteService.generateAvailablePath).toHaveBeenCalledWith(
      'Semana 1',
      WEEK_MATERIAL_ROUTE_PATH_PREFIX,
    );
    expect(pageRepo.runInTransaction).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('page-id');
    expect(result.videos.map((i) => i.id)).toEqual(['media-id']);
  });

  it('never publishes the page on creation, even if the payload asks for it', async () => {
    await service.createWeekMaterialsPage(validDto({ currentWeek: true }), {});

    expect(pageRepo.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ currentWeek: false }),
      manager,
    );
  });

  it('delegates persistence to the repository, never to the query runner', async () => {
    await service.createWeekMaterialsPage(validDto(), {});

    expect(pageRepo.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Semana 1', currentWeek: false }),
      manager,
    );
    expect(pageRepo.savePage).toHaveBeenCalledWith(expect.anything(), manager);
  });

  it('rejects uploaded media that did not declare its multipart field', async () => {
    const dto = validDto({
      videos: [
        {
          title: 'Vídeo',
          description: 'Desc',
          uploadType: UploadType.UPLOAD,
          mediaType: MediaType.VIDEO,
          isLocalFile: true,
        },
      ],
    });

    await expect(
      service.createWeekMaterialsPage(dto, {}),
    ).rejects.toBeInstanceOf(AppValidationException);
    expect(pageRepo.runInTransaction).not.toHaveBeenCalled();
  });

  it('rolls back and removes orphan media when media processing fails', async () => {
    const orphan = Object.assign(new MediaItemEntity(), {
      id: 'orphan',
      isLocalFile: true,
      url: 'https://s3/orphan',
    });
    mediaItemProcessor.processMediaItemsPolymorphic.mockRejectedValue(
      new Error('s3 down'),
    );
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([orphan]);

    await expect(
      service.createWeekMaterialsPage(validDto(), {}),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(pageRepo.runInTransaction).toHaveBeenCalledTimes(1);
    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [orphan],
      expect.any(Function),
    );
  });

  it('preserves an application error raised during creation', async () => {
    const appError = new AppValidationException(
      ErrorCode.MEDIA_FILE_NOT_FOUND,
      'Arquivo ausente',
    );
    mediaItemProcessor.processMediaItemsPolymorphic.mockRejectedValue(appError);
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([]);

    await expect(service.createWeekMaterialsPage(validDto(), {})).rejects.toBe(
      appError,
    );
  });

  it('does not fail the request when the compensation cleanup fails', async () => {
    mediaItemProcessor.processMediaItemsPolymorphic.mockRejectedValue(
      new Error('s3 down'),
    );
    mediaItemProcessor.findMediaItemsByTarget.mockRejectedValue(
      new Error('db down'),
    );

    await expect(
      service.createWeekMaterialsPage(validDto(), {}),
    ).rejects.toBeInstanceOf(AppInternalException);
  });
});
