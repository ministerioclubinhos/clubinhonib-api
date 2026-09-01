import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppNotFoundException,
  AppValidationException,
  ErrorCode,
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
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import { IdeasPageGetService } from './get-ideas-page.service';
import { IdeasPageUpdateService } from './update-ideas-page.service';

const buildSection = (
  id: string,
  overrides: Partial<IdeasSectionEntity> = {},
): IdeasSectionEntity =>
  Object.assign(new IdeasSectionEntity(), {
    id,
    title: `Seção ${id}`,
    description: '',
    public: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

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

const buildPage = (sections: IdeasSectionEntity[] = []): IdeasPageEntity =>
  Object.assign(new IdeasPageEntity(), {
    id: 'page-id',
    title: 'Ideias',
    subtitle: 'Subtítulo atual',
    description: 'Descrição',
    public: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sections,
    route,
  });

const sectionInput = (overrides: Record<string, unknown> = {}) => ({
  title: 'Abertura',
  description: 'Materiais',
  medias: [],
  ...overrides,
});

const validDto = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'page-id',
    title: 'Ideias revisadas',
    description: 'Nova descrição',
    sections: [],
    ...overrides,
  }) as never;

describe('IdeasPageUpdateService', () => {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
  };
  const ideasPageRepository = {
    updateContent: jest.fn(),
    createSection: jest.fn(),
    saveSection: jest.fn(),
    removeSectionsByIds: jest.fn(),
  };
  const getService = {
    findEntityOrFail: jest.fn(),
    buildResponse: jest.fn(),
  };
  const routeService = {
    findRouteByEntityId: jest.fn(),
    upsertRouteWithAvailablePath: jest.fn(),
  };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    findManyMediaItemsByTargets: jest.fn(),
    findMediaItemsByTarget: jest.fn(),
    deleteMediaItems: jest.fn(),
    removeMediaItem: jest.fn(),
    processMediaItemsPolymorphic: jest.fn(),
    buildBaseMediaItem: jest.fn(),
    upsertMediaItem: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: IdeasPageUpdateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    getService.findEntityOrFail.mockResolvedValue(buildPage());
    getService.buildResponse.mockResolvedValue({ id: 'page-id' });
    routeService.findRouteByEntityId.mockResolvedValue(route);
    routeService.upsertRouteWithAvailablePath.mockResolvedValue(route);
    ideasPageRepository.createSection.mockResolvedValue(buildSection('nova'));
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([]);
    mediaItemProcessor.buildBaseMediaItem.mockImplementation(
      (item: Record<string, unknown>) =>
        Object.assign(new MediaItemEntity(), item),
    );
    mediaItemProcessor.upsertMediaItem.mockImplementation(
      (id: string, media: MediaItemEntity) =>
        Object.assign(media, { id: id ?? 'nova' }),
    );
    mediaItemProcessor.discardUnreferencedUploads.mockResolvedValue(0);

    const moduleRef = await Test.createTestingModule({
      providers: [
        IdeasPageUpdateService,
        { provide: DataSource, useValue: dataSource },
        { provide: IdeasPageRepository, useValue: ideasPageRepository },
        { provide: IdeasPageGetService, useValue: getService },
        { provide: RouteService, useValue: routeService },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(IdeasPageUpdateService);
  });

  it('atualiza a página e a rota dentro de uma transação', async () => {
    const result = await service.updateIdeasPage('page-id', validDto(), {});

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(routeService.upsertRouteWithAvailablePath).toHaveBeenCalledWith(
      'route-id',
      expect.objectContaining({ title: 'Ideias revisadas', public: false }),
      'galeria_ideias_',
      manager,
    );
    expect(ideasPageRepository.updateContent).toHaveBeenCalledWith(
      'page-id',
      expect.objectContaining({
        title: 'Ideias revisadas',
        description: 'Nova descrição',
      }),
      manager,
    );
    expect(result).toEqual({ id: 'page-id' });
  });

  it('preserva subtítulo e visibilidade quando o payload os omite', async () => {
    await service.updateIdeasPage('page-id', validDto(), {});

    expect(ideasPageRepository.updateContent).toHaveBeenCalledWith(
      'page-id',
      expect.objectContaining({ subtitle: 'Subtítulo atual', public: false }),
      manager,
    );
  });

  it('remove seções que sumiram do payload, junto das mídias', async () => {
    const dropped = buildSection('dropped');
    getService.findEntityOrFail.mockResolvedValue(buildPage([dropped]));
    const media = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      isLocalFile: true,
      url: 'https://s3/a.png',
    });
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([media]);

    await service.updateIdeasPage('page-id', validDto({ sections: [] }), {});

    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [media],
      expect.any(Function),
    );
    expect(ideasPageRepository.removeSectionsByIds).toHaveBeenCalledWith([
      'dropped',
    ]);
  });

  it('cria as seções que chegam sem id', async () => {
    await service.updateIdeasPage(
      'page-id',
      validDto({ sections: [sectionInput()] }),
      {},
    );

    expect(ideasPageRepository.createSection).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Abertura', public: false }),
    );
  });

  it('atualiza a seção existente sem alterar a visibilidade dela', async () => {
    const existing = buildSection('s1', { public: true });
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));

    await service.updateIdeasPage(
      'page-id',
      validDto({
        sections: [sectionInput({ id: 's1', title: 'Novo título' })],
      }),
      {},
    );

    expect(ideasPageRepository.saveSection).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 's1',
        title: 'Novo título',
        public: true,
      }),
    );
    expect(ideasPageRepository.removeSectionsByIds).not.toHaveBeenCalled();
  });

  it('cria, em vez de sobrescrever, a seção cujo id não é da página', async () => {
    getService.findEntityOrFail.mockResolvedValue(buildPage([]));

    await service.updateIdeasPage(
      'page-id',
      validDto({ sections: [sectionInput({ id: 'de-outra-pagina' })] }),
      {},
    );

    expect(ideasPageRepository.saveSection).not.toHaveBeenCalled();
    expect(ideasPageRepository.createSection).toHaveBeenCalledTimes(1);
  });

  it('preserva o arquivo da mídia que não foi trocada', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));

    const storedMedia = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      url: 'https://s3/antiga.png',
      isLocalFile: true,
      originalName: 'antiga.png',
      size: 99,
      mediaType: MediaType.IMAGE,
      uploadType: UploadType.UPLOAD,
    });
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([storedMedia]);

    await service.updateIdeasPage(
      'page-id',
      validDto({
        sections: [
          sectionInput({
            id: 's1',
            medias: [
              {
                id: 'm1',
                title: 'Foto',
                description: '',
                mediaType: MediaType.IMAGE,
                uploadType: UploadType.UPLOAD,
                isLocalFile: true,
                url: 'https://s3/antiga.png',
              },
            ],
          }),
        ],
      }),
      {},
    );

    expect(awsS3Service.upload).not.toHaveBeenCalled();
    expect(awsS3Service.delete).not.toHaveBeenCalled();
    expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({
        url: 'https://s3/antiga.png',
        isLocalFile: true,
        originalName: 'antiga.png',
        size: 99,
      }),
    );
  });

  it('troca o arquivo de uma mídia já gravada quando um novo é enviado', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));

    const storedMedia = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      url: 'https://s3/antiga.png',
      isLocalFile: true,
    });
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([storedMedia]);
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');

    const file = {
      fieldname: 'image_0_0.png',
      originalname: 'nova.png',
      size: 42,
    } as Express.Multer.File;

    await service.updateIdeasPage(
      'page-id',
      validDto({
        sections: [
          sectionInput({
            id: 's1',
            medias: [
              {
                id: 'm1',
                title: 'Foto',
                description: '',
                mediaType: MediaType.IMAGE,
                uploadType: UploadType.UPLOAD,
                isLocalFile: true,
                fieldKey: 'image_0_0.png',
              },
            ],
          }),
        ],
      }),
      { 'image_0_0.png': file },
    );

    expect(awsS3Service.delete).toHaveBeenCalledWith('https://s3/antiga.png');
    expect(awsS3Service.upload).toHaveBeenCalledWith(file);
    expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({
        url: 'https://s3/nova.png',
        originalName: 'nova.png',
        size: 42,
      }),
    );

    // O arquivo antigo só pode sair depois que o registro aponta para o novo.
    const uploadedAt = awsS3Service.upload.mock.invocationCallOrder[0];
    const savedAt =
      mediaItemProcessor.upsertMediaItem.mock.invocationCallOrder[0];
    const deletedAt = awsS3Service.delete.mock.invocationCallOrder[0];
    expect(uploadedAt).toBeLessThan(savedAt);
    expect(savedAt).toBeLessThan(deletedAt);
  });

  it('descarta do S3 o arquivo enviado quando a atualização falha', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');
    mediaItemProcessor.upsertMediaItem.mockRejectedValue(new Error('db down'));

    const file = {
      fieldname: 'image_0_0.png',
      originalname: 'nova.png',
      size: 42,
    } as Express.Multer.File;

    await expect(
      service.updateIdeasPage(
        'page-id',
        validDto({
          sections: [
            sectionInput({
              id: 's1',
              medias: [
                {
                  title: 'Foto',
                  description: '',
                  mediaType: MediaType.IMAGE,
                  uploadType: UploadType.UPLOAD,
                  isLocalFile: true,
                  fieldKey: 'image_0_0.png',
                },
              ],
            }),
          ],
        }),
        { 'image_0_0.png': file },
      ),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/nova.png'],
      expect.any(Function),
    );
  });

  it('não apaga o arquivo antigo quando o upload do novo falha', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));

    const storedMedia = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      url: 'https://s3/antiga.png',
      isLocalFile: true,
    });
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([storedMedia]);
    awsS3Service.upload.mockRejectedValue(new Error('s3 fora do ar'));

    const file = {
      fieldname: 'image_0_0.png',
      originalname: 'nova.png',
      size: 42,
    } as Express.Multer.File;

    await expect(
      service.updateIdeasPage(
        'page-id',
        validDto({
          sections: [
            sectionInput({
              id: 's1',
              medias: [
                {
                  id: 'm1',
                  title: 'Foto',
                  description: '',
                  mediaType: MediaType.IMAGE,
                  uploadType: UploadType.UPLOAD,
                  isLocalFile: true,
                  fieldKey: 'image_0_0.png',
                },
              ],
            }),
          ],
        }),
        { 'image_0_0.png': file },
      ),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(awsS3Service.delete).not.toHaveBeenCalled();
  });

  it('apaga do S3 a mídia retirada da seção', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));

    const storedMedia = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      url: 'https://s3/antiga.png',
      isLocalFile: true,
    });
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([storedMedia]);

    await service.updateIdeasPage(
      'page-id',
      validDto({ sections: [sectionInput({ id: 's1', medias: [] })] }),
      {},
    );

    expect(mediaItemProcessor.removeMediaItem).toHaveBeenCalledWith(
      storedMedia,
      expect.any(Function),
    );
  });

  it('mantém no S3 o arquivo ainda referenciado por outra mídia enviada', async () => {
    const existing = buildSection('s1');
    getService.findEntityOrFail.mockResolvedValue(buildPage([existing]));

    const storedMedia = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      url: 'https://s3/mantida.png',
      isLocalFile: true,
    });
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([storedMedia]);

    await service.updateIdeasPage(
      'page-id',
      validDto({
        sections: [
          sectionInput({
            id: 's1',
            medias: [
              {
                title: 'Reaproveitada',
                description: '',
                mediaType: MediaType.IMAGE,
                uploadType: UploadType.LINK,
                isLocalFile: false,
                url: 'https://s3/mantida.png',
              },
            ],
          }),
        ],
      }),
      {},
    );

    expect(mediaItemProcessor.removeMediaItem).toHaveBeenCalledWith(
      storedMedia,
      undefined,
    );
  });

  it('recusa mídia nova marcada como upload sem o arquivo correspondente', async () => {
    await expect(
      service.updateIdeasPage(
        'page-id',
        validDto({
          sections: [
            sectionInput({
              medias: [
                {
                  title: 'Sem arquivo',
                  description: '',
                  mediaType: MediaType.IMAGE,
                  uploadType: UploadType.UPLOAD,
                  isLocalFile: true,
                  fieldKey: 'ausente',
                },
              ],
            }),
          ],
        }),
        {},
      ),
    ).rejects.toBeInstanceOf(AppValidationException);
  });

  it('falha quando a página não tem rota', async () => {
    routeService.findRouteByEntityId.mockResolvedValue(null);

    await expect(
      service.updateIdeasPage('page-id', validDto(), {}),
    ).rejects.toBeInstanceOf(AppNotFoundException);
  });

  it('propaga o not found de uma página inexistente', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Página de ideias não encontrada.',
    );
    getService.findEntityOrFail.mockRejectedValue(notFound);

    await expect(service.updateIdeasPage('x', validDto(), {})).rejects.toBe(
      notFound,
    );
  });

  it('embrulha falha inesperada de persistência', async () => {
    ideasPageRepository.updateContent.mockRejectedValue(new Error('db down'));

    await expect(
      service.updateIdeasPage('page-id', validDto(), {}),
    ).rejects.toBeInstanceOf(AppInternalException);
  });
});
