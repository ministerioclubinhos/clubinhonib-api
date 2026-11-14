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
    findOnePageById: jest.fn(),
  };
  const s3 = { upload: jest.fn(), delete: jest.fn() };
  const createRouteService = {
    createRouteWithAvailablePath: jest.fn(),
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
    pageRepo.findOnePageById.mockResolvedValue(null);
    pageRepo.savePage.mockImplementation(
      (page: WeekMaterialsPageEntity) => page,
    );
    createRouteService.createRouteWithAvailablePath.mockResolvedValue(
      savedRoute,
    );
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

    expect(
      createRouteService.createRouteWithAvailablePath,
    ).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ title: 'Semana 1', entityId: 'page-id' }),
      WEEK_MATERIAL_ROUTE_PATH_PREFIX,
      // Manual creation: the path keeps deriving from the title.
      undefined,
    );
    // Media rows join the page transaction so a rollback leaves none behind.
    const mediaCall = mediaItemProcessor.processMediaItemsPolymorphic.mock
      .calls[0] as unknown[];
    expect(mediaCall[5]).toBe(manager);
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

  it('rejects uploaded media whose file was not sent, before opening a transaction', async () => {
    const dto = validDto({
      documents: [
        {
          title: 'Lição',
          description: 'Desc',
          uploadType: UploadType.UPLOAD,
          mediaType: MediaType.DOCUMENT,
          isLocalFile: true,
          fieldKey: 'licao',
        },
      ],
    });

    // The multipart field is declared but no file came under it: a client
    // error, not an internal one.
    await expect(
      service.createWeekMaterialsPage(dto, {}),
    ).rejects.toBeInstanceOf(AppValidationException);
    expect(pageRepo.runInTransaction).not.toHaveBeenCalled();
    expect(
      mediaItemProcessor.processMediaItemsPolymorphic,
    ).not.toHaveBeenCalled();
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

  it('derives the route path from the server-side source while keeping the title', async () => {
    await service.createWeekMaterialsPage(
      validDto({ pageTitle: 'Semana 27 — O Bom Pastor' }),
      {},
      { routePathSource: 'Semana 27' },
    );

    expect(
      createRouteService.createRouteWithAvailablePath,
    ).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ title: 'Semana 27 — O Bom Pastor' }),
      WEEK_MATERIAL_ROUTE_PATH_PREFIX,
      'Semana 27',
    );
  });

  it('never deletes the media of a page that turned out to be committed', async () => {
    // Ambiguous commit: the transaction reported a failure but the page is
    // in the database, so its media rows and files belong to it.
    mediaItemProcessor.processMediaItemsPolymorphic.mockRejectedValue(
      new Error('connection lost'),
    );
    pageRepo.findOnePageById.mockResolvedValue(savedPage());

    await expect(
      service.createWeekMaterialsPage(validDto(), {}),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(mediaItemProcessor.findMediaItemsByTarget).not.toHaveBeenCalled();
    expect(mediaItemProcessor.deleteMediaItems).not.toHaveBeenCalled();
  });

  it('preserves an application error raised during creatio', async () => {
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

  it('leaves nothing behind when the route cannot be created', async () => {
    createRouteService.createRouteWithAvailablePath.mockRejectedValue(
      new Error('routes unavailable'),
    );
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([]);

    await expect(
      service.createWeekMaterialsPage(validDto(), {}),
    ).rejects.toBeInstanceOf(AppInternalException);

    // The failure happens inside the transaction: page and route roll back
    // together, no media was processed and no announcement goes out.
    expect(pageRepo.savePage).not.toHaveBeenCalled();
    expect(
      mediaItemProcessor.processMediaItemsPolymorphic,
    ).not.toHaveBeenCalled();
    expect(announceService.announceInBackground).not.toHaveBeenCalled();
  });

  it('discards the uploaded files when the page cannot be saved after the uploads', async () => {
    const file = {
      fieldname: 'licao',
      originalname: 'licao.pdf',
      buffer: Buffer.from('pdf'),
      size: 3,
      mimetype: 'application/pdf',
    } as Express.Multer.File;
    s3.upload.mockResolvedValue('https://s3/uploaded.pdf');
    mediaItemProcessor.processMediaItemsPolymorphic.mockImplementation(
      async (
        _items: unknown,
        _id: string,
        _type: string,
        files: Record<string, Express.Multer.File>,
        upload: (item: Express.Multer.File) => Promise<string>,
      ) => {
        await upload(files.licao);
        throw new Error('db down after upload');
      },
    );
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([]);

    await expect(
      service.createWeekMaterialsPage(
        validDto({
          videos: [],
          documents: [
            {
              title: 'Lição',
              description: 'Desc',
              uploadType: UploadType.UPLOAD,
              mediaType: MediaType.DOCUMENT,
              isLocalFile: true,
              fieldKey: 'licao',
            },
          ],
        }),
        { licao: file },
      ),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/uploaded.pdf'],
      expect.any(Function),
    );
    expect(announceService.announceInBackground).not.toHaveBeenCalled();
  });

  it('keeps a committed page when the announcement hook fails', async () => {
    // After the commit the page exists and owns its files: a failure in the
    // announcement neither fails the creation nor runs the compensation.
    announceService.announceInBackground.mockImplementation(() => {
      throw new Error('unexpected');
    });

    const result = await service.createWeekMaterialsPage(validDto(), {});

    expect(result.id).toBe('page-id');
    expect(mediaItemProcessor.findMediaItemsByTarget).not.toHaveBeenCalled();
    expect(mediaItemProcessor.deleteMediaItems).not.toHaveBeenCalled();
    expect(
      mediaItemProcessor.discardUnreferencedUploads,
    ).not.toHaveBeenCalled();
  });
});
