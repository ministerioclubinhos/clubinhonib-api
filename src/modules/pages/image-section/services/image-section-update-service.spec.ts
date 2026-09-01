import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppInternalException } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { ImageSectionRepository } from '../repository/image-section.repository';
import { ImagePageRepository } from 'src/modules/pages/image-page/repositories/image-page.repository';
import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';
import { ImageSectionUpdateService } from './image-section-update-service';

const storedMedia = Object.assign(new MediaItemEntity(), {
  id: 'media-1',
  url: 'https://s3/antiga.png',
  isLocalFile: true,
  originalName: 'antiga.png',
  size: 10,
  targetId: 'section-1',
  targetType: 'ImagesPage',
});

const section = Object.assign(new ImageSectionEntity(), {
  id: 'section-1',
  caption: 'Abertura',
  description: '',
  public: true,
});

const mediaInput = (overrides: Record<string, unknown> = {}) => ({
  id: 'media-1',
  title: 'Foto',
  description: '',
  mediaType: MediaType.IMAGE,
  uploadType: UploadType.UPLOAD,
  isLocalFile: true,
  fieldKey: 'file',
  ...overrides,
});

const dto = (mediaItems: Record<string, unknown>[] = [mediaInput()]) =>
  ({
    caption: 'Abertura',
    description: 'Descrição',
    public: true,
    mediaItems,
  }) as never;

describe('ImageSectionUpdateService', () => {
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOneBy: jest.fn(),
      save: jest.fn<Promise<unknown>, [unknown]>((value: unknown) =>
        Promise.resolve(value),
      ),
    },
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const configService = { get: jest.fn(() => 'page-id') };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    findManyMediaItemsByTargets: jest.fn(),
    deleteMediaItems: jest.fn(),
    buildBaseMediaItem: jest.fn(),
    saveMediaItem: jest.fn(),
    upsertMediaItem: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };
  const sectionRepo = { findOneBy: jest.fn() };
  const pageRepo = { findById: jest.fn() };

  let service: ImageSectionUpdateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    sectionRepo.findOneBy.mockResolvedValue(section);
    pageRepo.findById.mockResolvedValue({ id: 'page-id' });
    queryRunner.manager.findOneBy.mockResolvedValue(storedMedia);
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
      storedMedia,
    ]);
    mediaItemProcessor.buildBaseMediaItem.mockImplementation(
      (item: Record<string, unknown>) =>
        Object.assign(new MediaItemEntity(), item),
    );
    mediaItemProcessor.upsertMediaItem.mockImplementation(
      (id: string, media: MediaItemEntity) =>
        Object.assign(media, { id: id ?? 'nova' }),
    );
    mediaItemProcessor.saveMediaItem.mockImplementation(
      (media: MediaItemEntity) => Object.assign(media, { id: 'nova' }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImageSectionUpdateService,
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: dataSource },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: ImageSectionRepository, useValue: sectionRepo },
        { provide: ImagePageRepository, useValue: pageRepo },
      ],
    }).compile();

    service = moduleRef.get(ImageSectionUpdateService);
  });

  it('mantém o arquivo guardado quando a edição não envia um novo', async () => {
    await service.updateSection('section-1', dto(), {});

    expect(awsS3Service.upload).not.toHaveBeenCalled();
    expect(awsS3Service.delete).not.toHaveBeenCalled();
    expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalledWith(
      'media-1',
      expect.objectContaining({ url: 'https://s3/antiga.png' }),
    );
  });

  it('apaga o arquivo antigo depois de gravar o novo', async () => {
    // Antes o arquivo trocado simplesmente ficava no bucket, sem ninguém
    // referenciando.
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');
    const file = { originalname: 'nova.png', size: 42 } as Express.Multer.File;

    await service.updateSection('section-1', dto(), { file });

    expect(awsS3Service.delete).toHaveBeenCalledWith('https://s3/antiga.png');

    const uploadedAt = awsS3Service.upload.mock.invocationCallOrder[0];
    const savedAt =
      mediaItemProcessor.upsertMediaItem.mock.invocationCallOrder[0];
    const deletedAt = awsS3Service.delete.mock.invocationCallOrder[0];
    expect(uploadedAt).toBeLessThan(savedAt);
    expect(savedAt).toBeLessThan(deletedAt);
  });

  it('descarta do S3 o arquivo enviado quando a atualização falha', async () => {
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');
    queryRunner.manager.save.mockRejectedValueOnce(new Error('db down'));
    const file = { originalname: 'nova.png', size: 42 } as Express.Multer.File;

    await expect(
      service.updateSection('section-1', dto(), { file }),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/nova.png'],
      expect.any(Function),
    );
  });
});
