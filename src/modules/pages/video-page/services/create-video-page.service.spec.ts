import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  AppInternalException,
  AppValidationException,
} from 'src/shared/exceptions';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { VideosPage } from '../entities/video-page.entity';
import { CreateVideosPageDto } from '../dto/create-videos-page.dto';
import { CreateVideosPageService } from './create-video-page.service';

const validDto = (
  overrides: Partial<CreateVideosPageDto> = {},
): CreateVideosPageDto =>
  Object.assign(new CreateVideosPageDto(), {
    title: 'Galeria de vídeos',
    description: 'Descrição',
    public: true,
    videos: [
      {
        title: 'Vídeo',
        description: '',
        uploadType: UploadType.LINK,
        mediaType: MediaType.VIDEO,
        isLocalFile: false,
        url: 'https://youtube.com/embed/a',
      },
    ],
    ...overrides,
  });

describe('CreateVideosPageService', () => {
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {},
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const videosPageRepo = { createPage: jest.fn(), savePage: jest.fn() };
  const s3 = { upload: jest.fn(), delete: jest.fn() };
  const routeService = {
    generateAvailablePath: jest.fn(),
    createRouteWithManager: jest.fn(),
  };
  const mediaItemProcessor = {
    processMediaItemsPolymorphic: jest.fn(),
    findMediaItemsByTarget: jest.fn(),
    deleteMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: CreateVideosPageService;

  const savedPage = Object.assign(new VideosPage(), {
    id: 'page-id',
    name: 'Galeria de vídeos',
    description: 'Descrição',
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const route = {
    id: 'route-id',
    title: 'Galeria de vídeos',
    subtitle: 'Página de galeria de vídeos',
    public: true,
    image: '',
    idToFetch: 'page-id',
    path: 'galeria_videos_galeria',
    entityType: 'VideosPage',
    description: 'Descrição',
    entityId: 'page-id',
    type: RouteType.PAGE,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    videosPageRepo.createPage.mockResolvedValue(savedPage);
    videosPageRepo.savePage.mockImplementation((page: VideosPage) => {
      page.route = route as never;
      return page;
    });
    routeService.generateAvailablePath.mockResolvedValue(
      'galeria_videos_galeria',
    );
    routeService.createRouteWithManager.mockResolvedValue(route);
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateVideosPageService,
        { provide: DataSource, useValue: dataSource },
        { provide: VideosPageRepository, useValue: videosPageRepo },
        { provide: AwsS3Service, useValue: s3 },
        { provide: RouteService, useValue: routeService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(CreateVideosPageService);
  });

  it('cria página, rota e vídeos numa transação confirmada', async () => {
    const result = await service.execute(validDto(), {});

    expect(routeService.generateAvailablePath).toHaveBeenCalledWith(
      'Galeria de vídeos',
      'galeria_videos_',
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('page-id');
  });

  it('delega a persistência ao repositório, não ao query runner', async () => {
    await service.execute(validDto(), {});

    expect(videosPageRepo.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Galeria de vídeos' }),
      queryRunner.manager,
    );
  });

  it('recusa upload sem o campo multipart, antes de abrir transação', async () => {
    const dto = validDto({
      videos: [
        {
          title: 'Vídeo',
          description: '',
          uploadType: UploadType.UPLOAD,
          mediaType: MediaType.VIDEO,
          isLocalFile: true,
        },
      ],
    });

    await expect(service.execute(dto, {})).rejects.toBeInstanceOf(
      AppValidationException,
    );
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('recusa upload cujo arquivo não veio na requisição', async () => {
    const dto = validDto({
      videos: [
        {
          title: 'Vídeo',
          description: '',
          uploadType: UploadType.UPLOAD,
          mediaType: MediaType.VIDEO,
          isLocalFile: true,
          fieldKey: 'video_0',
        },
      ],
    });

    await expect(service.execute(dto, {})).rejects.toBeInstanceOf(
      AppValidationException,
    );
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('faz rollback e limpa mídia órfã quando a criação falha', async () => {
    const orphan = Object.assign(new MediaItemEntity(), {
      id: 'orphan',
      isLocalFile: true,
      url: 'https://s3/orphan.mp4',
    });
    mediaItemProcessor.processMediaItemsPolymorphic.mockRejectedValue(
      new Error('s3 fora'),
    );
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([orphan]);

    await expect(service.execute(validDto(), {})).rejects.toBeInstanceOf(
      AppInternalException,
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [orphan],
      expect.any(Function),
    );
  });
});
