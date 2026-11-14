import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppNotFoundException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { GetRouteService } from 'src/modules/routes/services/get-route.service';
import { UpdateRouteService } from 'src/modules/routes/services/update-route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { VideosPage } from '../entities/video-page.entity';
import { UpdateVideosPageDto } from '../dto/update-videos-page.dto';
import { GetVideosPageService } from './get-video-page.service';
import { UpdateVideosPageService } from './update-video-page.service';

const route = {
  id: 'route-id',
  title: 'Galeria',
  subtitle: '',
  public: true,
  current: false,
  image: '',
  idToFetch: 'page-id',
  path: 'galeria_videos_galeria',
  entityType: 'VideosPage',
  description: '',
  entityId: 'page-id',
  type: RouteType.PAGE,
};

const buildPage = (): VideosPage =>
  Object.assign(new VideosPage(), {
    id: 'page-id',
    name: 'Galeria',
    description: 'Descrição',
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    route,
  });

const buildVideo = (
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
    targetType: 'VideosPage',
    ...overrides,
  });

const validDto = (
  overrides: Partial<UpdateVideosPageDto> = {},
): UpdateVideosPageDto =>
  Object.assign(new UpdateVideosPageDto(), {
    id: 'page-id',
    title: 'Galeria revisada',
    description: 'Nova descrição',
    public: true,
    videos: [],
    ...overrides,
  });

describe('UpdateVideosPageService', () => {
  const manager = {} as EntityManager;
  // A transação passou a ser aberta pelo repositório: o caso de uso entrega
  // o bloco de escritas e não conhece mais `DataSource`.
  const videosPageRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    savePage: jest.fn(),
  };
  const getService = { findEntityOrFail: jest.fn(), findVideosOf: jest.fn() };
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

  let service: UpdateVideosPageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    getService.findEntityOrFail.mockResolvedValue(buildPage());
    getService.findVideosOf.mockResolvedValue([]);
    getRouteService.findRouteByEntityId.mockResolvedValue(route);
    updateRouteService.upsertRouteWithAvailablePath.mockResolvedValue(route);
    videosPageRepo.savePage.mockImplementation((page: VideosPage) => page);
    mediaItemProcessor.buildBaseMediaItem.mockImplementation(
      (item: Record<string, unknown>) =>
        Object.assign(new MediaItemEntity(), item),
    );
    mediaItemProcessor.upsertMediaItem.mockImplementation(
      (_id: string, media: MediaItemEntity) => media,
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateVideosPageService,
        { provide: VideosPageRepository, useValue: videosPageRepo },
        { provide: GetVideosPageService, useValue: getService },
        { provide: AwsS3Service, useValue: s3 },
        { provide: GetRouteService, useValue: getRouteService },
        { provide: UpdateRouteService, useValue: updateRouteService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(UpdateVideosPageService);
  });

  it('atualiza a página e a rota dentro de uma transação', async () => {
    const result = await service.execute('page-id', validDto(), {});

    expect(videosPageRepo.runInTransaction).toHaveBeenCalledTimes(1);
    expect(
      updateRouteService.upsertRouteWithAvailablePath,
    ).toHaveBeenCalledWith(
      'route-id',
      expect.objectContaining({ title: 'Galeria revisada' }),
      'galeria_videos_',
      manager,
    );
    expect(videosPageRepo.savePage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Galeria revisada' }),
      manager,
    );
    expect(result.id).toBe('page-id');
  });

  it('remove vídeos que sumiram do payload', async () => {
    const dropped = buildVideo('dropped');
    getService.findVideosOf.mockResolvedValue([dropped]);

    await service.execute('page-id', validDto({ videos: [] }), {});

    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [dropped],
      expect.any(Function),
    );
  });

  it('cria os vídeos que chegam sem id', async () => {
    await service.execute(
      'page-id',
      validDto({
        videos: [
          {
            title: 'Novo',
            description: '',
            uploadType: UploadType.LINK,
            mediaType: MediaType.VIDEO,
            isLocalFile: false,
            url: 'https://youtube.com/embed/novo',
          },
        ],
      }),
      {},
    );

    expect(
      mediaItemProcessor.processMediaItemsPolymorphic,
    ).toHaveBeenCalledWith(
      [expect.objectContaining({ title: 'Novo' })],
      'page-id',
      'VideosPage',
      {},
      expect.any(Function),
    );
  });

  it('preserva o arquivo do upload que não foi trocado', async () => {
    const stored = buildVideo('v1', {
      uploadType: UploadType.UPLOAD,
      isLocalFile: true,
      url: 'https://s3/antigo.mp4',
      originalName: 'antigo.mp4',
      size: 99,
    });
    getService.findVideosOf.mockResolvedValue([stored]);

    await service.execute(
      'page-id',
      validDto({
        videos: [
          {
            id: 'v1',
            title: 'Vídeo',
            description: '',
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
      'v1',
      expect.objectContaining({
        url: 'https://s3/antigo.mp4',
        isLocalFile: true,
        originalName: 'antigo.mp4',
        size: 99,
      }),
    );
  });

  it('troca o arquivo quando um novo é enviado', async () => {
    const stored = buildVideo('v1', {
      uploadType: UploadType.UPLOAD,
      isLocalFile: true,
      url: 'https://s3/antigo.mp4',
    });
    getService.findVideosOf.mockResolvedValue([stored]);
    s3.upload.mockResolvedValue('https://s3/novo.mp4');

    const file = {
      fieldname: 'video_0',
      originalname: 'novo.mp4',
      size: 42,
    } as Express.Multer.File;

    await service.execute(
      'page-id',
      validDto({
        videos: [
          {
            id: 'v1',
            title: 'Vídeo',
            description: '',
            uploadType: UploadType.UPLOAD,
            mediaType: MediaType.VIDEO,
            isLocalFile: true,
            fieldKey: 'video_0',
          },
        ],
      }),
      { video_0: file },
    );

    expect(s3.delete).toHaveBeenCalledWith('https://s3/antigo.mp4');
    expect(s3.upload).toHaveBeenCalledWith(file);
    expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        url: 'https://s3/novo.mp4',
        originalName: 'novo.mp4',
        size: 42,
      }),
    );
  });

  it('atualiza um vídeo de link sem tocar no S3', async () => {
    getService.findVideosOf.mockResolvedValue([buildVideo('v1')]);

    await service.execute(
      'page-id',
      validDto({
        videos: [
          {
            id: 'v1',
            title: 'Vídeo',
            description: '',
            uploadType: UploadType.LINK,
            mediaType: MediaType.VIDEO,
            isLocalFile: false,
            platformType: PlatformType.YOUTUBE,
            url: '  https://youtube.com/embed/atualizado  ',
          },
        ],
      }),
      {},
    );

    expect(s3.upload).not.toHaveBeenCalled();
    expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        url: 'https://youtube.com/embed/atualizado',
        isLocalFile: false,
      }),
    );
  });

  it('recusa vídeo novo de upload sem o arquivo, antes de mexer na mídia', async () => {
    getService.findVideosOf.mockResolvedValue([buildVideo('v1')]);

    await expect(
      service.execute(
        'page-id',
        validDto({
          videos: [
            {
              title: 'Novo',
              description: '',
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

  it('falha quando a página não tem rota', async () => {
    getRouteService.findRouteByEntityId.mockResolvedValue(null);

    await expect(
      service.execute('page-id', validDto(), {}),
    ).rejects.toBeInstanceOf(AppNotFoundException);
  });

  it('propaga o not found de uma página inexistente', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.VIDEO_NOT_FOUND,
      'Página de vídeos não encontrada.',
    );
    getService.findEntityOrFail.mockRejectedValue(notFound);

    await expect(service.execute('x', validDto(), {})).rejects.toBe(notFound);
  });

  it('embrulha falha inesperada de persistência', async () => {
    videosPageRepo.savePage.mockRejectedValue(new Error('db down'));

    await expect(
      service.execute('page-id', validDto(), {}),
    ).rejects.toBeInstanceOf(AppInternalException);
  });
});
