import { Test } from '@nestjs/testing';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { GetUsersService } from './get-user.service';
import { UpdateUserImageService } from './update-user-image.service';

const storedMedia = Object.assign(new MediaItemEntity(), {
  id: 'media-1',
  url: 'https://s3/antiga.png',
  isLocalFile: true,
  targetId: 'user-1',
  targetType: 'UserEntity',
});

const imageFile = {
  fieldname: 'file',
  originalname: 'nova.png',
  mimetype: 'image/png',
  size: 42,
} as Express.Multer.File;

const body = { imageData: JSON.stringify({ title: 'Foto', fieldKey: 'file' }) };

describe('UpdateUserImageService', () => {
  const getUsersService = { findOne: jest.fn() };
  const s3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    findMediaItemByTarget: jest.fn(),
    buildBaseMediaItem: jest.fn(),
    upsertMediaItem: jest.fn(),
    saveMediaItem: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: UpdateUserImageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getUsersService.findOne.mockResolvedValue({ id: 'user-1' });
    mediaItemProcessor.findMediaItemByTarget.mockResolvedValue(storedMedia);
    mediaItemProcessor.buildBaseMediaItem.mockImplementation(
      (item: Record<string, unknown>) =>
        Object.assign(new MediaItemEntity(), item),
    );
    s3Service.upload.mockResolvedValue('https://s3/nova.png');

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateUserImageService,
        { provide: GetUsersService, useValue: getUsersService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: AwsS3Service, useValue: s3Service },
      ],
    }).compile();

    service = moduleRef.get(UpdateUserImageService);
  });

  it('aceita só o arquivo, sem imageData, como o painel administrativo envia', async () => {
    mediaItemProcessor.findMediaItemByTarget.mockResolvedValue(null);

    await service.updateUserImage('user-1', {}, [imageFile]);

    expect(s3Service.upload).toHaveBeenCalledWith(imageFile);
    expect(mediaItemProcessor.saveMediaItem).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://s3/nova.png',
        isLocalFile: true,
        originalName: 'nova.png',
      }),
    );
  });

  it('sem arquivo e sem imageData continua recusando', async () => {
    await expect(service.updateUserImage('user-1', {}, [])).rejects.toThrow(
      'imageData é obrigatório',
    );
  });

  it('sobe a foto nova e grava antes de apagar a antiga', async () => {
    // Na ordem inversa, uma falha no upload deixava o usuário sem foto.
    await service.updateUserImage('user-1', body, [imageFile]);

    expect(s3Service.delete).toHaveBeenCalledWith('https://s3/antiga.png');

    const uploadedAt = s3Service.upload.mock.invocationCallOrder[0];
    const savedAt =
      mediaItemProcessor.upsertMediaItem.mock.invocationCallOrder[0];
    const deletedAt = s3Service.delete.mock.invocationCallOrder[0];
    expect(uploadedAt).toBeLessThan(savedAt);
    expect(savedAt).toBeLessThan(deletedAt);
  });

  it('preserva a foto antiga quando o upload da nova falha', async () => {
    s3Service.upload.mockRejectedValue(new Error('s3 fora do ar'));

    await expect(
      service.updateUserImage('user-1', body, [imageFile]),
    ).rejects.toThrow('s3 fora do ar');

    expect(s3Service.delete).not.toHaveBeenCalled();
  });

  it('descarta do S3 a foto enviada quando a gravação falha', async () => {
    mediaItemProcessor.upsertMediaItem.mockRejectedValue(new Error('db down'));

    await expect(
      service.updateUserImage('user-1', body, [imageFile]),
    ).rejects.toThrow('db down');

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/nova.png'],
      expect.any(Function),
    );
    expect(s3Service.delete).not.toHaveBeenCalled();
  });

  it('não apaga nada quando o usuário ainda não tinha foto', async () => {
    mediaItemProcessor.findMediaItemByTarget.mockResolvedValue(null);

    await service.updateUserImage('user-1', body, [imageFile]);

    expect(mediaItemProcessor.saveMediaItem).toHaveBeenCalled();
    expect(s3Service.delete).not.toHaveBeenCalled();
  });
});
