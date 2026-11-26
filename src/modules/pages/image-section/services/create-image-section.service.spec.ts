import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { AppValidationException } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { NotificationService } from 'src/shared/providers/notification/notification.service';
import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';

import { CreateImageSectionDto } from '../dto/create-image-section.dto';
import { ImageSectionRepository } from '../repository/image-section.repository';
import { ImageSectionCreateService } from './create-image-section.service';

const buildSection = (): ImageSectionEntity =>
  Object.assign(new ImageSectionEntity(), {
    id: 'section-id',
    caption: 'Encontro de sábado',
    description: 'fotos',
    public: false,
    page: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

const dto: CreateImageSectionDto = {
  caption: 'Encontro de sábado',
  description: 'fotos',
  mediaItems: [
    {
      uploadType: UploadType.LINK,
      mediaType: MediaType.IMAGE,
      isLocalFile: false,
      url: 'https://example.com/photo.jpg',
    },
  ],
};

describe('ImageSectionCreateService', () => {
  const manager = {} as EntityManager;
  // A transação é aberta pelo repositório: o caso de uso entrega o bloco de
  // escritas e não conhece mais `DataSource`.
  const imageSectionRepository = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    createInTransaction: jest.fn(),
  };
  const mediaItemProcessor = {
    buildBaseMediaItem: jest.fn(),
    saveMediaItemInTransaction: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };
  const notificationService = { notifyNewImageShared: jest.fn() };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };

  let service: ImageSectionCreateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    imageSectionRepository.createInTransaction.mockResolvedValue(
      buildSection(),
    );
    mediaItemProcessor.buildBaseMediaItem.mockReturnValue(
      new MediaItemEntity(),
    );
    mediaItemProcessor.saveMediaItemInTransaction.mockImplementation(
      (_manager: EntityManager, media: MediaItemEntity) =>
        Promise.resolve(media),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImageSectionCreateService,
        { provide: ImageSectionRepository, useValue: imageSectionRepository },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = moduleRef.get(ImageSectionCreateService);
  });

  it('grava as fotos fora do ar e avisa a administração depois do commit', async () => {
    const ordem: string[] = [];
    imageSectionRepository.runInTransaction.mockImplementation(
      async (run: (m: EntityManager) => Promise<unknown>) => {
        const resultado = await run(manager);
        ordem.push('commit');
        return resultado;
      },
    );
    notificationService.notifyNewImageShared.mockImplementation(() => {
      ordem.push('aviso');
      return Promise.resolve();
    });

    const resposta = await service.createSection(
      dto,
      {},
      {
        email: 'quem@enviou.com',
        userId: 'sender-id',
      },
    );

    // Nascem sem página e fora do ar: publicar é decisão da administração.
    expect(imageSectionRepository.createInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        public: false,
        page: null,
        author: { id: 'sender-id' },
      }),
    );
    expect(mediaItemProcessor.buildBaseMediaItem).toHaveBeenCalledWith(
      dto.mediaItems[0],
      'section-id',
      MediaTargetType.ImagesPage,
    );
    expect(mediaItemProcessor.saveMediaItemInTransaction).toHaveBeenCalledWith(
      manager,
      expect.any(MediaItemEntity),
    );
    // O aviso sai só depois do commit: avisar antes anunciaria uma publicação
    // que o rollback pode desfazer.
    expect(ordem).toEqual(['commit', 'aviso']);
    expect(resposta.public).toBe(false);
    expect(resposta.pageId).toBeNull();
  });

  it('recusa upload declarado sem o arquivo correspondente', async () => {
    const comUpload: CreateImageSectionDto = {
      ...dto,
      mediaItems: [
        {
          title: 'foto',
          description: '',
          uploadType: UploadType.UPLOAD,
          mediaType: MediaType.IMAGE,
          isLocalFile: true,
          originalName: 'foto.jpg',
          fieldKey: 'ausente',
        },
      ],
    };

    await expect(service.createSection(comUpload, {})).rejects.toBeInstanceOf(
      AppValidationException,
    );

    expect(notificationService.notifyNewImageShared).not.toHaveBeenCalled();
  });

  it('varre os arquivos já enviados quando a transação falha', async () => {
    imageSectionRepository.createInTransaction.mockRejectedValue(
      new Error('banco fora'),
    );

    await expect(service.createSection(dto, {})).rejects.toThrow();

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledTimes(
      1,
    );
    expect(notificationService.notifyNewImageShared).not.toHaveBeenCalled();
  });
  it('uploads a video before the transaction and saves its actual file metadata', async () => {
    const file = {
      fieldname: 'clip',
      originalname: 'clip.webm',
      mimetype: 'video/webm',
      size: 12,
      buffer: Buffer.from([26, 69, 223, 163, 0, 0, 0, 0, 0, 0, 0, 0]),
    } as Express.Multer.File;
    awsS3Service.upload.mockResolvedValue('https://bucket/clip.webm');
    const response = await service.createSection(
      {
        ...dto,
        mediaItems: [
          {
            mediaType: MediaType.VIDEO,
            uploadType: UploadType.UPLOAD,
            isLocalFile: true,
            fieldKey: 'clip',
          },
        ],
      },
      { clip: file },
      { userId: 'teacher' },
    );
    expect(response.mediaItems[0]).toMatchObject({
      url: 'https://bucket/clip.webm',
      originalName: 'clip.webm',
      size: 12,
      isLocalFile: true,
    });
    expect(awsS3Service.upload.mock.invocationCallOrder[0]).toBeLessThan(
      imageSectionRepository.createInTransaction.mock.invocationCallOrder[0],
    );
    expect(mediaItemProcessor.saveMediaItemInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ url: 'https://bucket/clip.webm' }),
    );
  });
});
