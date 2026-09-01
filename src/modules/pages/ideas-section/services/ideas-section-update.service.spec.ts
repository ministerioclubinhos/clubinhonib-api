import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppInternalException } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasSectionRepository } from '../repository/ideas-section.repository';
import { IdeasSectionMediaType } from '../enums/ideas-section-media-type.enum';
import { IdeasSectionUpdateService } from './ideas-section-update.service';

const storedMedia = Object.assign(new MediaItemEntity(), {
  id: 'media-1',
  url: 'https://s3/antiga.png',
  isLocalFile: true,
  originalName: 'antiga.png',
  size: 10,
  targetId: 'section-1',
  targetType: 'IdeasSection',
});

const section = Object.assign(new IdeasSectionEntity(), {
  id: 'section-1',
  title: 'Abertura',
  description: '',
  public: true,
});

const mediaInput = (overrides: Record<string, unknown> = {}) => ({
  id: 'media-1',
  title: 'Foto',
  description: '',
  mediaType: IdeasSectionMediaType.IMAGE,
  uploadType: UploadType.UPLOAD,
  isLocalFile: true,
  originalName: 'antiga.png',
  ...overrides,
});

const dto = (medias: Record<string, unknown>[] = [mediaInput()]) =>
  ({
    title: 'Abertura',
    description: 'Descrição',
    public: true,
    medias,
  }) as never;

describe('IdeasSectionUpdateService', () => {
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn<Promise<unknown>, [unknown, unknown?]>(
      (_entity: unknown, value?: unknown) => Promise.resolve(value ?? _entity),
    ),
    delete: jest.fn(),
  };
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    buildBaseMediaItem: jest.fn(),
    saveMediaItem: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };
  const ideasSectionRepository = {};

  let service: IdeasSectionUpdateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    manager.findOne.mockResolvedValue(section);
    manager.find.mockResolvedValue([storedMedia]);
    manager.save.mockImplementation((_entity: unknown, value?: unknown) =>
      Promise.resolve(value ?? _entity),
    );
    mediaItemProcessor.buildBaseMediaItem.mockImplementation(
      (item: Record<string, unknown>) =>
        Object.assign(new MediaItemEntity(), item),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        IdeasSectionUpdateService,
        { provide: DataSource, useValue: dataSource },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: IdeasSectionRepository, useValue: ideasSectionRepository },
      ],
    }).compile();

    service = moduleRef.get(IdeasSectionUpdateService);
  });

  it('mantém o arquivo guardado quando a edição não envia um novo', async () => {
    // Antes a URL vinha do payload e, sem ela, a mídia ficava sem arquivo.
    await service.updateSection('section-1', dto(), {});

    expect(awsS3Service.upload).not.toHaveBeenCalled();
    expect(awsS3Service.delete).not.toHaveBeenCalled();

    const saved = manager.save.mock.calls.find(
      ([entity]) => entity === MediaItemEntity,
    );
    expect(saved?.[1]).toMatchObject({ url: 'https://s3/antiga.png' });
  });

  it('troca o arquivo e apaga o antigo só depois de gravar', async () => {
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');
    const file = { originalname: 'nova.png', size: 42 } as Express.Multer.File;

    await service.updateSection(
      'section-1',
      dto([mediaInput({ fieldKey: 'file' })]),
      { file },
    );

    expect(awsS3Service.upload).toHaveBeenCalledWith(file);
    expect(awsS3Service.delete).toHaveBeenCalledWith('https://s3/antiga.png');

    const uploadedAt = awsS3Service.upload.mock.invocationCallOrder[0];
    const deletedAt = awsS3Service.delete.mock.invocationCallOrder[0];
    expect(uploadedAt).toBeLessThan(deletedAt);
  });

  it('descarta do S3 o arquivo enviado quando a atualização falha', async () => {
    awsS3Service.upload.mockResolvedValue('https://s3/nova.png');
    const file = { originalname: 'nova.png', size: 42 } as Express.Multer.File;
    manager.save.mockImplementation((entity: unknown, value?: unknown) => {
      if (entity === MediaItemEntity)
        return Promise.reject(new Error('db down'));
      return Promise.resolve(value ?? entity);
    });

    await expect(
      service.updateSection(
        'section-1',
        dto([mediaInput({ fieldKey: 'file' })]),
        { file },
      ),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/nova.png'],
      expect.any(Function),
    );
  });
});
