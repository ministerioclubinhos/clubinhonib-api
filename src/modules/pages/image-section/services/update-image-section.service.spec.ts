import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';

import {
  AppInternalException,
  AppNotFoundException,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';
import { ImagePageEntity } from 'src/modules/pages/image-page/entity/Image-page.entity';
import { ImagePageGetService } from 'src/modules/pages/image-page/services/get-image-page.service';

import { UpdateImageSectionDto } from '../dto/update-image-section.dto';
import { ImageSectionRepository } from '../repository/image-section.repository';
import { ImageSectionUpdateService } from './update-image-section.service';

const buildSection = (): ImageSectionEntity =>
  Object.assign(new ImageSectionEntity(), {
    id: 'section-id',
    caption: 'antes',
    description: 'antes',
    public: false,
    page: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

const page = Object.assign(new ImagePageEntity(), { id: 'feed-page-id' });

const buildMedia = (id: string, url: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    url,
    isLocalFile: true,
    targetId: 'section-id',
    targetType: MediaTargetType.ImagesPage,
  });

const dto: UpdateImageSectionDto = {
  caption: 'depois',
  description: 'depois',
  public: true,
  mediaItems: [],
};

describe('ImageSectionUpdateService', () => {
  const manager = {} as EntityManager;
  // A transação é aberta pelo repositório: o caso de uso entrega o bloco de
  // escritas e não conhece mais `DataSource`.
  const sectionRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    findById: jest.fn(),
    saveInTransaction: jest.fn(),
  };
  const imagePageGetService = { findEntity: jest.fn() };
  const mediaItemProcessor = {
    findManyMediaItemsByTargets: jest.fn(),
    findMediaItemById: jest.fn(),
    buildBaseMediaItem: jest.fn(),
    saveMediaItem: jest.fn(),
    upsertMediaItem: jest.fn(),
    deleteMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };
  const configService = { get: jest.fn() };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };

  let service: ImageSectionUpdateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockReturnValue('feed-page-id');
    sectionRepo.findById.mockResolvedValue(buildSection());
    sectionRepo.saveInTransaction.mockImplementation(
      (_m: EntityManager, secao: ImageSectionEntity) => Promise.resolve(secao),
    );
    imagePageGetService.findEntity.mockResolvedValue(page);
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImageSectionUpdateService,
        { provide: ConfigService, useValue: configService },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: ImageSectionRepository, useValue: sectionRepo },
        { provide: ImagePageGetService, useValue: imagePageGetService },
      ],
    }).compile();

    service = moduleRef.get(ImageSectionUpdateService);
  });

  it('publica a seção no feed e grava numa transação', async () => {
    const resposta = await service.updateSection('section-id', dto, {});

    expect(sectionRepo.runInTransaction).toHaveBeenCalledTimes(1);
    expect(sectionRepo.saveInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        id: 'section-id',
        caption: 'depois',
        public: true,
        page,
      }),
    );
    expect(resposta.pageId).toBe('feed-page-id');
  });

  it('apaga do banco e do bucket a mídia que saiu da seção', async () => {
    const removida = buildMedia('m1', 'https://bucket/velha.jpg');
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
      removida,
    ]);

    await service.updateSection('section-id', dto, {});

    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [removida],
      expect.any(Function),
    );
  });

  it('pergunta a mídia ao módulo de mídia, sem abrir a tabela', async () => {
    const existente = buildMedia('m1', 'https://bucket/atual.jpg');
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
      existente,
    ]);
    mediaItemProcessor.findMediaItemById.mockResolvedValue(existente);
    mediaItemProcessor.buildBaseMediaItem.mockReturnValue(
      Object.assign(new MediaItemEntity(), { url: '' }),
    );
    mediaItemProcessor.upsertMediaItem.mockImplementation(
      (_id: string, media: MediaItemEntity) => Promise.resolve(media),
    );

    await service.updateSection(
      'section-id',
      {
        ...dto,
        mediaItems: [
          {
            id: 'm1',
            title: 'foto',
            description: '',
            uploadType: UploadType.LINK,
            mediaType: MediaType.IMAGE,
            isLocalFile: false,
            url: 'https://exemplo/foto.jpg',
          },
        ],
      },
      {},
    );

    expect(mediaItemProcessor.findMediaItemById).toHaveBeenCalledWith('m1');
    expect(mediaItemProcessor.upsertMediaItem).toHaveBeenCalled();
  });

  it('avisa quando a seção não existe', async () => {
    sectionRepo.findById.mockResolvedValue(null);

    await expect(
      service.updateSection('sumida', dto, {}),
    ).rejects.toBeInstanceOf(AppNotFoundException);

    expect(sectionRepo.saveInTransaction).not.toHaveBeenCalled();
  });

  it('falha de forma explícita quando FEED_CLUBINHO_PAGE_ID não está configurado', async () => {
    configService.get.mockReturnValue(undefined);

    await expect(
      service.updateSection('section-id', dto, {}),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(imagePageGetService.findEntity).not.toHaveBeenCalled();
  });

  it('varre os arquivos já enviados quando a gravação falha', async () => {
    sectionRepo.saveInTransaction.mockRejectedValue(new Error('banco fora'));

    await expect(
      service.updateSection('section-id', dto, {}),
    ).rejects.toThrow();

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledTimes(
      1,
    );
  });
});
