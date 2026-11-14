import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { AppNotFoundException } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';

import { ImageSectionRepository } from '../repository/image-section.repository';
import { ImageSectionDeleteService } from './delete-image-section.service';

const section = Object.assign(new ImageSectionEntity(), {
  id: 'section-id',
  caption: 'Encontro',
  description: '',
  public: false,
  page: null,
});

const media = Object.assign(new MediaItemEntity(), {
  id: 'media-id',
  url: 'https://bucket/foto.jpg',
  isLocalFile: true,
  targetId: 'section-id',
  targetType: MediaTargetType.ImagesPage,
});

describe('ImageSectionDeleteService', () => {
  const manager = {} as EntityManager;
  // A transação é aberta pelo repositório: o caso de uso entrega o bloco de
  // escritas e não conhece mais `DataSource`.
  const sectionRepository = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    findById: jest.fn(),
    removeInTransaction: jest.fn(),
  };
  const mediaItemProcessor = {
    findMediaItemsByTarget: jest.fn(),
    deleteMediaItems: jest.fn(),
  };
  const awsS3Service = { delete: jest.fn() };

  let service: ImageSectionDeleteService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImageSectionDeleteService,
        { provide: ImageSectionRepository, useValue: sectionRepository },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: AwsS3Service, useValue: awsS3Service },
      ],
    }).compile();

    service = moduleRef.get(ImageSectionDeleteService);
  });

  it('remove as mídias e a seção', async () => {
    sectionRepository.findById.mockResolvedValue(section);
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([media]);

    await service.deleteSection('section-id');

    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [media],
      expect.any(Function),
    );
    expect(sectionRepository.runInTransaction).toHaveBeenCalledTimes(1);
    expect(sectionRepository.removeInTransaction).toHaveBeenCalledWith(
      manager,
      section,
    );
  });

  it('não remove nada quando a seção não existe', async () => {
    sectionRepository.findById.mockResolvedValue(null);

    await expect(service.deleteSection('sumida')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );

    expect(mediaItemProcessor.deleteMediaItems).not.toHaveBeenCalled();
    expect(sectionRepository.removeInTransaction).not.toHaveBeenCalled();
  });

  it('não deixa a seção órfã quando a remoção da mídia falha', async () => {
    sectionRepository.findById.mockResolvedValue(section);
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([media]);
    mediaItemProcessor.deleteMediaItems.mockRejectedValue(new Error('S3 fora'));

    await expect(service.deleteSection('section-id')).rejects.toThrow();

    expect(sectionRepository.removeInTransaction).not.toHaveBeenCalled();
  });
});
