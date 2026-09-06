import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { GetRouteService } from 'src/modules/routes/services/get-route.service';
import { UpdateRouteService } from 'src/modules/routes/services/update-route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  AppInternalException,
  AppNotFoundException,
  AppValidationException,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { WeekMaterialsPageRepository } from '../repositories/week-material-page.repository';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { UpdateWeekMaterialsPageDto } from '../dto/update-week-material.dto';
import { WeekMaterialsPageGetService } from './get-week-material.service';
import { WeekMaterialsPageUpdateService } from './update-week-material.service';

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
      current: false,
    },
    ...overrides,
  });

const buildMedia = (
  id: string,
  overrides: Partial<MediaItemEntity> = {},
): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    title: id,
    description: '',
    mediaType: MediaType.VIDEO,
    uploadType: UploadType.LINK,
    url: `https://example.com/${id}`,
    isLocalFile: false,
    size: 0,
    originalName: '',
    targetId: 'page-id',
    targetType: 'WeekMaterialsPage',
    ...overrides,
  });

const validDto = (
  overrides: Partial<UpdateWeekMaterialsPageDto> = {},
): UpdateWeekMaterialsPageDto =>
  Object.assign(new UpdateWeekMaterialsPageDto(), {
    pageTitle: 'Semana 1 revisada',
    pageSubtitle: 'Novo tema',
    pageDescription: 'Nova descrição',
    ...overrides,
  });

describe('WeekMaterialsPageUpdateService', () => {
  const manager = {} as EntityManager;
  // A transação passou a ser aberta pelo repositório: o caso de uso entrega
  // o bloco de escritas e não conhece mais `DataSource`.
  const pageRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    savePage: jest.fn(),
    findOnePageById: jest.fn(),
    findCurrentWeek: jest.fn(),
  };
  const getService = {
    findOnePage: jest.fn(),
    findMediaOfPage: jest.fn(),
  };
  const s3 = { upload: jest.fn(), delete: jest.fn() };
  const rotaMockBase = {
    findRouteByEntityId: jest.fn(),
    upsertRouteWithAvailablePath: jest.fn(),
  };
  const getRouteService = rotaMockBase;
  const updateRouteService = rotaMockBase;
  const mediaItemProcessor = {
    deleteMediaItems: jest.fn(),
    processMediaItemsPolymorphic: jest.fn(),
    buildBaseMediaItem: jest.fn(),
    upsertMediaItem: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: WeekMaterialsPageUpdateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    getService.findOnePage.mockResolvedValue(buildPage());
    getService.findMediaOfPage.mockResolvedValue([]);
    getRouteService.findRouteByEntityId.mockResolvedValue(buildPage().route);
    updateRouteService.upsertRouteWithAvailablePath.mockImplementation(
      (routeId: string, data: Record<string, unknown>) => ({
        ...buildPage().route,
        ...data,
        id: routeId,
      }),
    );
    pageRepo.savePage.mockImplementation(
      (page: WeekMaterialsPageEntity) => page,
    );
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue([]);
    mediaItemProcessor.buildBaseMediaItem.mockImplementation(
      (item: Record<string, unknown>) =>
        Object.assign(new MediaItemEntity(), item),
    );
    mediaItemProcessor.upsertMediaItem.mockImplementation(
      (_id: string, media: MediaItemEntity) => media,
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        WeekMaterialsPageUpdateService,
        { provide: WeekMaterialsPageRepository, useValue: pageRepo },
        { provide: WeekMaterialsPageGetService, useValue: getService },
        { provide: AwsS3Service, useValue: s3 },
        { provide: GetRouteService, useValue: getRouteService },
        { provide: UpdateRouteService, useValue: updateRouteService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(WeekMaterialsPageUpdateService);
  });

  describe('updateWeekMaterialsPage', () => {
    it('updates the page content and its route inside a transaction', async () => {
      const result = await service.updateWeekMaterialsPage(
        'page-id',
        validDto(),
        {},
      );

      expect(pageRepo.runInTransaction).toHaveBeenCalledTimes(1);
      expect(
        updateRouteService.upsertRouteWithAvailablePath,
      ).toHaveBeenCalledWith(
        'route-id',
        expect.objectContaining({ title: 'Semana 1 revisada' }),
        'materiais_semanal_',
        manager,
      );
      expect(pageRepo.savePage).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Semana 1 revisada' }),
        manager,
      );
      expect(result.title).toBe('Semana 1 revisada');
    });

    it('resolve um path livre em vez de repetir o de outra rota', async () => {
      await service.updateWeekMaterialsPage('page-id', validDto(), {});

      // O path é único no banco: quem resolve a disponibilidade é o RouteService,
      // recebendo apenas o prefixo do módulo.
      const [, routeData, prefix] = updateRouteService
        .upsertRouteWithAvailablePath.mock.calls[0] as [
        string,
        Record<string, unknown>,
        string,
      ];
      expect(routeData).not.toHaveProperty('path');
      expect(prefix).toBe('materiais_semanal_');
    });

    it('keeps the current week flag when the payload omits it', async () => {
      getService.findOnePage.mockResolvedValue(
        buildPage({ currentWeek: true }),
      );

      const result = await service.updateWeekMaterialsPage(
        'page-id',
        validDto(),
        {},
      );

      expect(result.currentWeek).toBe(true);
    });

    it('ignores currentWeek sent in the payload: publishing has its own route', async () => {
      getService.findOnePage.mockResolvedValue(
        buildPage({ currentWeek: false }),
      );

      const result = await service.updateWeekMaterialsPage(
        'page-id',
        validDto({ currentWeek: true }),
        {},
      );

      expect(result.currentWeek).toBe(false);
    });

    it('removes media dropped by the client', async () => {
      const dropped = buildMedia('dropped');
      getService.findMediaOfPage.mockResolvedValue([dropped]);

      await service.updateWeekMaterialsPage('page-id', validDto(), {});

      expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
        [dropped],
        expect.any(Function),
      );
    });

    it('creates media items that arrive without an id', async () => {
      const dto = validDto({
        videos: [
          {
            title: 'Novo',
            description: 'Desc',
            uploadType: UploadType.LINK,
            mediaType: MediaType.VIDEO,
            isLocalFile: false,
            url: 'https://example.com/new',
          },
        ],
      });

      await service.updateWeekMaterialsPage('page-id', dto, {});

      expect(
        mediaItemProcessor.processMediaItemsPolymorphic,
      ).toHaveBeenCalledWith(
        [expect.objectContaining({ title: 'Novo' })],
        'page-id',
        'WeekMaterialsPage',
        {},
        expect.any(Function),
      );
    });

    it('replaces the stored file when an existing upload receives a new file', async () => {
      const existing = buildMedia('m1', {
        uploadType: UploadType.UPLOAD,
        isLocalFile: true,
        url: 'https://s3/old.mp4',
      });
      getService.findMediaOfPage.mockResolvedValue([existing]);
      s3.upload.mockResolvedValue('https://s3/new.mp4');

      const file = {
        fieldname: 'video_0',
        originalname: 'new.mp4',
        size: 42,
      } as Express.Multer.File;

      await service.updateWeekMaterialsPage(
        'page-id',
        validDto({
          videos: [
            {
              id: 'm1',
              title: 'Vídeo',
              description: 'Desc',
              uploadType: UploadType.UPLOAD,
              mediaType: MediaType.VIDEO,
              isLocalFile: true,
              fieldKey: 'video_0',
            },
          ],
        }),
        { video_0: file },
      );

      expect(s3.delete).toHaveBeenCalledWith('https://s3/old.mp4');
      expect(s3.upload).toHaveBeenCalledWith(file);
      expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({
          url: 'https://s3/new.mp4',
          isLocalFile: true,
          originalName: 'new.mp4',
          size: 42,
        }),
      );
    });

    it('preserves the stored file of an upload kept untouched', async () => {
      const existing = buildMedia('m1', {
        uploadType: UploadType.UPLOAD,
        isLocalFile: true,
        url: 'https://s3/old.mp4',
        originalName: 'old.mp4',
        size: 99,
      });
      getService.findMediaOfPage.mockResolvedValue([existing]);

      await service.updateWeekMaterialsPage(
        'page-id',
        validDto({
          videos: [
            {
              id: 'm1',
              title: 'Vídeo',
              description: 'Desc',
              uploadType: UploadType.UPLOAD,
              mediaType: MediaType.VIDEO,
              isLocalFile: true,
            },
          ],
        }),
        {},
      );

      expect(s3.upload).not.toHaveBeenCalled();
      expect(s3.delete).not.toHaveBeenCalled();
      expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({
          url: 'https://s3/old.mp4',
          isLocalFile: true,
          originalName: 'old.mp4',
          size: 99,
        }),
      );
    });

    it('updates a linked media item without touching S3', async () => {
      getService.findMediaOfPage.mockResolvedValue([buildMedia('m1')]);

      await service.updateWeekMaterialsPage(
        'page-id',
        validDto({
          videos: [
            {
              id: 'm1',
              title: 'Vídeo',
              description: 'Desc',
              uploadType: UploadType.LINK,
              mediaType: MediaType.VIDEO,
              isLocalFile: false,
              platformType: PlatformType.YOUTUBE,
              url: '  https://example.com/updated  ',
            },
          ],
        }),
        {},
      );

      expect(s3.upload).not.toHaveBeenCalled();
      expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({
          url: 'https://example.com/updated',
          isLocalFile: false,
        }),
      );
    });

    it('fails when the page has no route', async () => {
      getRouteService.findRouteByEntityId.mockResolvedValue(null);

      await expect(
        service.updateWeekMaterialsPage('page-id', validDto(), {}),
      ).rejects.toBeInstanceOf(AppNotFoundException);
    });

    it('propagates the not-found error of an unknown page', async () => {
      const notFound = new AppNotFoundException(
        'CONTENT_8612' as never,
        'Página não encontrada',
      );
      getService.findOnePage.mockRejectedValue(notFound);

      await expect(
        service.updateWeekMaterialsPage('missing', validDto(), {}),
      ).rejects.toBe(notFound);
    });

    it('rejects uploaded media without a multipart field', async () => {
      await expect(
        service.updateWeekMaterialsPage(
          'page-id',
          validDto({
            videos: [
              {
                title: 'Vídeo',
                description: 'Desc',
                uploadType: UploadType.UPLOAD,
                mediaType: MediaType.VIDEO,
                isLocalFile: true,
              },
            ],
          }),
          {},
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('rejects a new upload whose file was not sent, before touching media', async () => {
      const existing = buildMedia('m1');
      getService.findMediaOfPage.mockResolvedValue([existing]);

      await expect(
        service.updateWeekMaterialsPage(
          'page-id',
          validDto({
            videos: [
              {
                title: 'Vídeo',
                description: 'Desc',
                uploadType: UploadType.UPLOAD,
                mediaType: MediaType.VIDEO,
                isLocalFile: true,
                fieldKey: 'video_0',
              },
            ],
          }),
          {},
        ),
      ).rejects.toBeInstanceOf(AppValidationException);

      expect(mediaItemProcessor.deleteMediaItems).not.toHaveBeenCalled();
      expect(
        mediaItemProcessor.processMediaItemsPolymorphic,
      ).not.toHaveBeenCalled();
    });

    it('wraps an unexpected persistence failure', async () => {
      pageRepo.savePage.mockRejectedValue(new Error('db down'));

      await expect(
        service.updateWeekMaterialsPage('page-id', validDto(), {}),
      ).rejects.toBeInstanceOf(AppInternalException);
    });
  });

  describe('setCurrentWeek', () => {
    it('publishes the page and clears the previous one', async () => {
      const previous = buildPage({
        id: 'previous-id',
        currentWeek: true,
        route: { ...buildPage().route, id: 'previous-route', current: true },
      });
      const target = buildPage();
      pageRepo.findOnePageById.mockResolvedValue(target);
      pageRepo.findCurrentWeek.mockResolvedValue(previous);

      const result = await service.setCurrentWeek('page-id');

      expect(previous.currentWeek).toBe(false);
      expect(previous.route.current).toBe(false);
      expect(target.currentWeek).toBe(true);
      expect(target.route.current).toBe(true);
      expect(target.route.public).toBe(true);
      expect(result.currentWeek).toBe(true);
      expect(pageRepo.savePage).toHaveBeenCalledTimes(2);
    });

    it('does not rewrite the previous page when it is the target', async () => {
      const target = buildPage({ currentWeek: true });
      pageRepo.findOnePageById.mockResolvedValue(target);
      pageRepo.findCurrentWeek.mockResolvedValue(target);

      await service.setCurrentWeek('page-id');

      expect(pageRepo.savePage).toHaveBeenCalledTimes(1);
    });

    it('fails when the page does not exist', async () => {
      pageRepo.findOnePageById.mockResolvedValue(null);

      await expect(service.setCurrentWeek('missing')).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
    });
  });
});
