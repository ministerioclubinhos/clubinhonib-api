import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppValidationException,
} from 'src/shared/exceptions';
import { CreateRouteService } from 'src/modules/routes/services/create-route.service';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { ImagePageCreateService } from './create-image-page.service';

const media = (overrides: Record<string, unknown> = {}) => ({
  title: 'Foto',
  description: '',
  mediaType: MediaType.IMAGE,
  uploadType: UploadType.UPLOAD,
  isLocalFile: true,
  fieldKey: 'f0',
  ...overrides,
});

const dtoWith = (mediaItems: unknown[]) =>
  ({
    title: 'Galeria',
    description: 'Descrição',
    public: true,
    sections: [
      { caption: 'Abertura', description: '', public: true, mediaItems },
    ],
  }) as never;

describe('ImagePageCreateService', () => {
  const manager = {} as EntityManager;
  const imagePageRepository = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    createPage: jest.fn(),
    savePage: jest.fn(),
    createSection: jest.fn(),
    findByIdWithSections: jest.fn(),
  };
  const createRouteService = {
    generateAvailablePath: jest.fn(),
    createRouteWithManager: jest.fn(),
  };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    processMediaItemsPolymorphic: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  const page = Object.assign(new ImagePageEntity(), {
    id: 'page-id',
    name: 'Galeria',
    description: 'Descrição',
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
    type: 'page',
  };

  let service: ImagePageCreateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    imagePageRepository.createPage.mockResolvedValue(page);
    imagePageRepository.savePage.mockImplementation((p: ImagePageEntity) => p);
    imagePageRepository.createSection.mockResolvedValue(
      Object.assign(new ImageSectionEntity(), { id: 's1' }),
    );
    imagePageRepository.findByIdWithSections.mockResolvedValue({
      ...page,
      route,
      sections: [],
    });
    createRouteService.generateAvailablePath.mockResolvedValue(route.path);
    createRouteService.createRouteWithManager.mockResolvedValue(route);
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagePageCreateService,
        { provide: ImagePageRepository, useValue: imagePageRepository },
        { provide: CreateRouteService, useValue: createRouteService },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(ImagePageCreateService);
  });

  it('cria galeria, rota, seção e mídias na mesma transação', async () => {
    const result = await service.createImagePage(dtoWith([media()]), {
      f0: { fieldname: 'f0' } as Express.Multer.File,
    });

    expect(imagePageRepository.runInTransaction).toHaveBeenCalledTimes(1);
    expect(createRouteService.createRouteWithManager).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ title: 'Galeria' }),
    );
    expect(imagePageRepository.createSection).toHaveBeenCalledWith(
      page,
      expect.objectContaining({ caption: 'Abertura' }),
      manager,
    );
    // A mídia vai na transação da galeria: o rollback a desfaz sozinho.
    expect(
      mediaItemProcessor.processMediaItemsPolymorphic,
    ).toHaveBeenCalledWith(
      [expect.objectContaining({ title: 'Foto', fileField: 'f0' })],
      's1',
      'ImagesPage',
      expect.anything(),
      expect.any(Function),
      manager,
    );
    expect(result.id).toBe('page-id');
  });

  it('descarta os uploads desta tentativa se a criação falha', async () => {
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');
    mediaItemProcessor.processMediaItemsPolymorphic.mockImplementation(
      async (
        _items: unknown,
        _id: string,
        _type: string,
        files: Record<string, Express.Multer.File>,
        upload: (file: Express.Multer.File) => Promise<string>,
      ) => {
        await upload(files.f0);
        throw new Error('db fora');
      },
    );

    await expect(
      service.createImagePage(dtoWith([media()]), {
        f0: { fieldname: 'f0' } as Express.Multer.File,
      }),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/nova.png'],
      expect.any(Function),
    );
  });

  it('recusa upload sem arquivo e link inválido antes de abrir a transação', async () => {
    await expect(
      service.createImagePage(dtoWith([media()]), {}),
    ).rejects.toBeInstanceOf(AppValidationException);

    await expect(
      service.createImagePage(
        dtoWith([
          media({
            uploadType: UploadType.LINK,
            isLocalFile: false,
            fieldKey: undefined,
            url: 'drive.google.com/sem-esquema',
          }),
        ]),
        {},
      ),
    ).rejects.toThrow('Seção 1 · Imagem 1 · Link');

    expect(imagePageRepository.runInTransaction).not.toHaveBeenCalled();
    expect(awsS3Service.upload).not.toHaveBeenCalled();
  });
});
