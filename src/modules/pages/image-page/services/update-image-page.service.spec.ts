import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppNotFoundException,
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
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { ImagePageGetService } from './get-image-page.service';
import { ImagePageUpdateService } from './update-image-page.service';

const buildSection = (id: string): ImageSectionEntity =>
  Object.assign(new ImageSectionEntity(), {
    id,
    caption: `Seção ${id}`,
    description: '',
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const route = {
  id: 'route-id',
  title: 'Galeria',
  subtitle: '',
  public: true,
  current: false,
  image: '',
  idToFetch: 'page-id',
  path: 'galeria_imagens_galeria',
  entityType: 'ImagesPage',
  description: '',
  entityId: 'page-id',
  type: RouteType.PAGE,
};

const buildPage = (sections: ImageSectionEntity[] = []): ImagePageEntity =>
  Object.assign(new ImagePageEntity(), {
    id: 'page-id',
    name: 'Galeria',
    description: 'Descrição',
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    sections,
    route,
  });

const sectionInput = (overrides: Record<string, unknown> = {}) => ({
  caption: 'Abertura',
  description: 'Fotos',
  public: true,
  mediaItems: [],
  ...overrides,
});

const validDto = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'page-id',
    title: 'Galeria revisada',
    description: 'Nova descrição',
    public: true,
    sections: [],
    ...overrides,
  }) as never;

describe('ImagePageUpdateService', () => {
  const manager = {} as EntityManager;
  // A transação passou a ser aberta pelo repositório: o caso de uso entrega
  // o bloco de escritas e não conhece mais `DataSource`.
  const imagePageRepository = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    savePage: jest.fn(),
    findById: jest.fn(),
    findByIdWithSections: jest.fn(),
    findSectionById: jest.fn(),
    saveSection: jest.fn(),
    createSection: jest.fn(),
    removeSectionsByIds: jest.fn(),
  };
  const getService = {
    findEntityOrFail: jest.fn(),
    findMediaOfSections: jest.fn(),
  };
  const rotaMockBase = {
    findRouteByEntityId: jest.fn(),
    upsertRouteWithAvailablePath: jest.fn(),
  };
  const getRouteService = rotaMockBase;
  const updateRouteService = rotaMockBase;
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    findMediaItemsByTargetInTransaction: jest.fn(),
    deleteMediaItemByIdInTransaction: jest.fn(),
    deleteMediaItemsByTargetInTransaction: jest.fn(),
    saveMediaItemInTransaction: jest.fn(),
    processMediaItemsPolymorphic: jest.fn(),
    buildBaseMediaItem: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: ImagePageUpdateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    getService.findEntityOrFail.mockResolvedValue(buildPage());
    getService.findMediaOfSections.mockResolvedValue(new Map());
    getRouteService.findRouteByEntityId.mockResolvedValue(route);
    updateRouteService.upsertRouteWithAvailablePath.mockResolvedValue(route);
    imagePageRepository.savePage.mockImplementation(
      (page: ImagePageEntity) => page,
    );
    imagePageRepository.findByIdWithSections.mockResolvedValue(buildPage());
    imagePageRepository.findById.mockImplementation(() => {
      const fresh = buildPage();
      delete (fresh as Partial<ImagePageEntity>).sections;
      return Promise.resolve(fresh);
    });
    imagePageRepository.createSection.mockResolvedValue(buildSection('nova'));
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue(
      [],
    );
    mediaItemProcessor.buildBaseMediaItem.mockImplementation(
      (item: Record<string, unknown>) =>
        Object.assign(new MediaItemEntity(), item),
    );
    mediaItemProcessor.saveMediaItemInTransaction.mockImplementation(
      (_manager: EntityManager, media: MediaItemEntity) => media,
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagePageUpdateService,
        { provide: ImagePageRepository, useValue: imagePageRepository },
        { provide: ImagePageGetService, useValue: getService },
        { provide: GetRouteService, useValue: getRouteService },
        { provide: UpdateRouteService, useValue: updateRouteService },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(ImagePageUpdateService);
  });

  it('atualiza a galeria e a rota dentro de uma transação', async () => {
    const result = await service.updateImagePage('page-id', validDto(), {});

    expect(imagePageRepository.runInTransaction).toHaveBeenCalledTimes(1);
    expect(
      updateRouteService.upsertRouteWithAvailablePath,
    ).toHaveBeenCalledWith(
      'route-id',
      expect.objectContaining({ title: 'Galeria revisada' }),
      'galeria_imagens_',
      manager,
    );
    expect(imagePageRepository.savePage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Galeria revisada' }),
      manager,
    );
    expect(result.id).toBe('page-id');
  });

  it('grava a galeria a partir de uma leitura sem as seções antigas (cascade não as regrava)', async () => {
    const stale = buildSection('stale');
    getService.findEntityOrFail.mockResolvedValue(buildPage([stale]));

    await service.updateImagePage('page-id', validDto({ sections: [] }), {});

    // Antes, a instância com `sections` carregadas era salva depois da
    // sincronização e o `cascade` reinseria a seção recém-removida.
    expect(imagePageRepository.findById).toHaveBeenCalledWith(
      'page-id',
      manager,
    );
    const [saved] = imagePageRepository.savePage.mock.calls[0] as [
      ImagePageEntity,
      EntityManager,
    ];
    expect(saved.sections).toBeUndefined();
  });

  it('remove seções que sumiram do payload, junto das mídias', async () => {
    const dropped = buildSection('dropped');
    getService.findEntityOrFail.mockResolvedValue(buildPage([dropped]));
    const media = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      isLocalFile: true,
      url: 'https://s3/a.png',
    });
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue([
      media,
    ]);

    await service.updateImagePage('page-id', validDto({ sections: [] }), {});

    expect(
      mediaItemProcessor.deleteMediaItemsByTargetInTransaction,
    ).toHaveBeenCalledWith(manager, 'dropped', 'ImagesPage');
    expect(imagePageRepository.removeSectionsByIds).toHaveBeenCalledWith(
      ['dropped'],
      manager,
    );
    // O arquivo só sai do S3 depois do commit.
    expect(awsS3Service.delete).not.toHaveBeenCalled();
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/a.png'],
      expect.any(Function),
    );
  });

  it('não apaga os arquivos antigos quando a transação falha', async () => {
    const dropped = buildSection('dropped');
    getService.findEntityOrFail.mockResolvedValue(buildPage([dropped]));
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue([
      Object.assign(new MediaItemEntity(), {
        id: 'm1',
        isLocalFile: true,
        url: 'https://s3/a.png',
      }),
    ]);
    imagePageRepository.savePage.mockRejectedValue(new Error('db down'));

    await expect(
      service.updateImagePage('page-id', validDto({ sections: [] }), {}),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(
      mediaItemProcessor.discardUnreferencedUploads,
    ).not.toHaveBeenCalledWith(['https://s3/a.png'], expect.any(Function));
    expect(awsS3Service.delete).not.toHaveBeenCalled();
  });

  it('descarta os uploads desta tentativa quando a transação falha', async () => {
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');
    imagePageRepository.savePage.mockRejectedValue(new Error('db down'));
    imagePageRepository.createSection.mockResolvedValue(buildSection('nova'));
    mediaItemProcessor.processMediaItemsPolymorphic.mockImplementation(
      async (
        _items: unknown,
        _id: string,
        _type: string,
        files: Record<string, Express.Multer.File>,
        upload: (file: Express.Multer.File) => Promise<string>,
      ) => {
        await upload(files.f0);
        return [];
      },
    );

    await expect(
      service.updateImagePage(
        'page-id',
        validDto({
          sections: [
            sectionInput({
              mediaItems: [
                {
                  title: 'Foto',
                  description: '',
                  mediaType: MediaType.IMAGE,
                  uploadType: UploadType.UPLOAD,
                  isLocalFile: true,
                  fieldKey: 'f0',
                },
              ],
            }),
          ],
        }),
        {
          f0: { fieldname: 'f0', originalname: 'f.png' } as Express.Multer.File,
        },
      ),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/nova.png'],
      expect.any(Function),
    );
  });

  it('cria as seções que chegam sem id', async () => {
    await service.updateImagePage(
      'page-id',
      validDto({ sections: [sectionInput()] }),
      {},
    );

    expect(imagePageRepository.createSection).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ caption: 'Abertura' }),
      manager,
    );
  });

  it('atualiza as seções que mantiveram o id', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));
    imagePageRepository.findSectionById.mockResolvedValue(existing);

    await service.updateImagePage(
      'page-id',
      validDto({
        sections: [sectionInput({ id: 's1', caption: 'Nova legenda' })],
      }),
      {},
    );

    expect(imagePageRepository.saveSection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', caption: 'Nova legenda' }),
      manager,
    );
    // Nada a remover: o serviço nem chega a consultar o repositório.
    expect(imagePageRepository.removeSectionsByIds).not.toHaveBeenCalled();
  });

  it('preserva o arquivo da mídia que não foi trocada', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));
    imagePageRepository.findSectionById.mockResolvedValue(existing);

    const storedMedia = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      url: 'https://s3/antiga.png',
      isLocalFile: true,
      originalName: 'antiga.png',
      size: 99,
      mediaType: MediaType.IMAGE,
      uploadType: UploadType.UPLOAD,
    });
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue([
      storedMedia,
    ]);

    await service.updateImagePage(
      'page-id',
      validDto({
        sections: [
          sectionInput({
            id: 's1',
            mediaItems: [
              {
                id: 'm1',
                title: 'Foto',
                description: '',
                mediaType: MediaType.IMAGE,
                uploadType: UploadType.UPLOAD,
                isLocalFile: true,
              },
            ],
          }),
        ],
      }),
      {},
    );

    expect(awsS3Service.upload).not.toHaveBeenCalled();
    expect(awsS3Service.delete).not.toHaveBeenCalled();
    expect(mediaItemProcessor.saveMediaItemInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        id: 'm1',
        url: 'https://s3/antiga.png',
        isLocalFile: true,
        originalName: 'antiga.png',
        size: 99,
      }),
    );
  });

  it('troca o arquivo quando um novo é enviado', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));
    imagePageRepository.findSectionById.mockResolvedValue(existing);

    const storedMedia = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      url: 'https://s3/antiga.png',
      isLocalFile: true,
    });
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue([
      storedMedia,
    ]);
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');

    const file = {
      fieldname: 'image_0',
      originalname: 'nova.png',
      size: 42,
    } as Express.Multer.File;

    await service.updateImagePage(
      'page-id',
      validDto({
        sections: [
          sectionInput({
            id: 's1',
            mediaItems: [
              {
                id: 'm1',
                title: 'Foto',
                description: '',
                mediaType: MediaType.IMAGE,
                uploadType: UploadType.UPLOAD,
                isLocalFile: true,
                fieldKey: 'image_0',
              },
            ],
          }),
        ],
      }),
      { image_0: file },
    );

    expect(awsS3Service.upload).toHaveBeenCalledWith(file);
    // O arquivo antigo só sai depois do commit.
    expect(awsS3Service.delete).not.toHaveBeenCalled();
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/antiga.png'],
      expect.any(Function),
    );
    expect(mediaItemProcessor.saveMediaItemInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        id: 'm1',
        url: 'https://s3/nova.png',
        originalName: 'nova.png',
        size: 42,
      }),
    );
  });

  it('falha quando a galeria não tem rota', async () => {
    getRouteService.findRouteByEntityId.mockResolvedValue(null);

    await expect(
      service.updateImagePage('page-id', validDto(), {}),
    ).rejects.toBeInstanceOf(AppNotFoundException);
  });

  it('propaga o not found de uma galeria inexistente', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Página de galeria não encontrada.',
    );
    getService.findEntityOrFail.mockRejectedValue(notFound);

    await expect(service.updateImagePage('x', validDto(), {})).rejects.toBe(
      notFound,
    );
  });

  it('embrulha falha inesperada de persistência', async () => {
    imagePageRepository.savePage.mockRejectedValue(new Error('db down'));

    await expect(
      service.updateImagePage('page-id', validDto(), {}),
    ).rejects.toBeInstanceOf(AppInternalException);
  });
});
