import { UserEntity } from 'src/core/user/entities/user.entity';
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
    mediaType: MediaType.IMAGE,
  });

const dto: UpdateImageSectionDto = {
  caption: 'depois',
  description: 'depois',
  public: true,
  mediaItems: [
    {
      uploadType: UploadType.LINK,
      mediaType: MediaType.IMAGE,
      isLocalFile: false,
      url: 'https://example.com/photo.jpg',
    },
  ],
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
    saveMediaItemInTransaction: jest.fn(),
    deleteMediaItemByIdInTransaction: jest.fn(),
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
    mediaItemProcessor.buildBaseMediaItem.mockReturnValue(
      Object.assign(new MediaItemEntity(), {
        url: 'https://example.com/photo.jpg',
      }),
    );
    mediaItemProcessor.saveMediaItemInTransaction.mockImplementation(
      (_manager: EntityManager, media: MediaItemEntity) =>
        Promise.resolve(media),
    );

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

    expect(
      mediaItemProcessor.deleteMediaItemByIdInTransaction,
    ).toHaveBeenCalledWith(manager, 'm1');
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      [removida.url],
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

    expect(mediaItemProcessor.saveMediaItemInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: 'm1' }),
    );
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
  it('preserves the original author and detaches a saved draft from the feed', async () => {
    const original = buildSection();
    original.author = Object.assign(new UserEntity(), {
      id: 'teacher-id',
      name: 'Professora Ana',
    });
    original.page = page;
    sectionRepo.findById.mockResolvedValue(original);
    const response = await service.updateSection(
      'section-id',
      { ...dto, public: false },
      {},
    );
    expect(response.author).toEqual({ name: 'Professora Ana' });
    expect(response.pageId).toBeNull();
    expect(response.public).toBe(false);
  });

  it('rejects mixed media before any upload, save or removal', async () => {
    await expect(
      service.updateSection(
        'section-id',
        {
          ...dto,
          mediaItems: [
            ...dto.mediaItems,
            { ...dto.mediaItems[0], mediaType: MediaType.VIDEO },
          ],
        },
        {},
      ),
    ).rejects.toThrow();
    expect(sectionRepo.saveInTransaction).not.toHaveBeenCalled();
    expect(
      mediaItemProcessor.saveMediaItemInTransaction,
    ).not.toHaveBeenCalled();
    expect(
      mediaItemProcessor.deleteMediaItemByIdInTransaction,
    ).not.toHaveBeenCalled();
    expect(awsS3Service.upload).not.toHaveBeenCalled();
  });

  it('does not delete old storage objects when the transaction fails', async () => {
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
      buildMedia('old', 'https://bucket/old.jpg'),
    ]);
    sectionRepo.saveInTransaction.mockRejectedValue(
      new Error('database failure'),
    );
    await expect(
      service.updateSection('section-id', dto, {}),
    ).rejects.toThrow();
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      [],
      expect.any(Function),
    );
    expect(awsS3Service.delete).not.toHaveBeenCalled();
  });
  it('preserves an existing uploaded video when editing only its text', async () => {
    const stored = Object.assign(
      buildMedia('video', 'https://bucket/clip.webm'),
      { mediaType: MediaType.VIDEO, originalName: 'clip.webm', size: 12 },
    );
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([stored]);
    const response = await service.updateSection(
      'section-id',
      {
        ...dto,
        mediaItems: [
          {
            id: 'video',
            mediaType: MediaType.VIDEO,
            uploadType: UploadType.UPLOAD,
            isLocalFile: true,
          },
        ],
      },
      {},
    );
    expect(response.mediaItems[0]).toMatchObject({
      id: 'video',
      url: stored.url,
      originalName: 'clip.webm',
      size: 12,
    });
    expect(awsS3Service.upload).not.toHaveBeenCalled();
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      [],
      expect.any(Function),
    );
  });

  it('replaces a video and cleans the old file only after committing', async () => {
    const old = Object.assign(buildMedia('video', 'https://bucket/old.webm'), {
      mediaType: MediaType.VIDEO,
    });
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([old]);
    const file = {
      fieldname: 'clip',
      originalname: 'new.webm',
      mimetype: 'video/webm',
      size: 12,
      buffer: Buffer.from([26, 69, 223, 163, 0, 0, 0, 0, 0, 0, 0, 0]),
    } as Express.Multer.File;
    awsS3Service.upload.mockResolvedValue('https://bucket/new.webm');
    const response = await service.updateSection(
      'section-id',
      {
        ...dto,
        mediaItems: [
          {
            id: 'video',
            mediaType: MediaType.VIDEO,
            uploadType: UploadType.UPLOAD,
            isLocalFile: true,
            fieldKey: 'clip',
          },
        ],
      },
      { clip: file },
    );
    expect(response.mediaItems[0]).toMatchObject({
      url: 'https://bucket/new.webm',
      size: 12,
    });
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      [old.url],
      expect.any(Function),
    );
    expect(
      mediaItemProcessor.discardUnreferencedUploads.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      sectionRepo.saveInTransaction.mock.invocationCallOrder[0],
    );
  });

  it('reviews a legacy album without assigning the reviewer as author or changing stored files', async () => {
    const legacy = buildSection();
    legacy.author = null;
    sectionRepo.findById.mockResolvedValue(legacy);
    const stored = buildMedia('legacy-photo', 'https://bucket/legacy.jpg');
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([stored]);
    const result = await service.updateSection(
      'section-id',
      {
        ...dto,
        mediaItems: [
          {
            id: stored.id,
            mediaType: MediaType.IMAGE,
            uploadType: UploadType.UPLOAD,
            isLocalFile: true,
          },
        ],
      },
      {},
    );
    expect(result.author).toBeNull();
    expect(result.mediaItems[0].url).toBe(stored.url);
    expect(awsS3Service.upload).not.toHaveBeenCalled();
    expect(
      mediaItemProcessor.deleteMediaItemByIdInTransaction,
    ).not.toHaveBeenCalled();
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      [],
      expect.any(Function),
    );
  });
});
