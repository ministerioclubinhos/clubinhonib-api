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
  mediaItems: [],
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
    processMediaItemsPolymorphic: jest.fn(),
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
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue(
      [] as MediaItemEntity[],
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
      },
    );

    // Nascem sem página e fora do ar: publicar é decisão da administração.
    expect(imageSectionRepository.createInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ public: false, page: null }),
    );
    expect(
      mediaItemProcessor.processMediaItemsPolymorphic,
    ).toHaveBeenCalledWith(
      [],
      'section-id',
      MediaTargetType.ImagesPage,
      {},
      expect.anything(),
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
});
