import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DeleteRouteService } from 'src/modules/routes/services/delete-route.service';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { ImagePageGetService } from './get-image-page.service';
import { ImagePageDeleteService } from './delete-image-page.service';

const section = (id: string): ImageSectionEntity =>
  Object.assign(new ImageSectionEntity(), { id });

const buildPage = (sections: ImageSectionEntity[] = []): ImagePageEntity =>
  Object.assign(new ImagePageEntity(), {
    id: 'page-id',
    name: 'Galeria',
    description: '',
    public: true,
    route: { id: 'route-id' },
    sections,
  });

const media = (id: string, isLocalFile: boolean): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    isLocalFile,
    url: isLocalFile ? `https://s3/${id}.png` : `https://drive/${id}`,
  });

describe('ImagePageDeleteService', () => {
  const manager = {} as EntityManager;
  const imagePageRepository = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    removePage: jest.fn(),
  };
  const getService = { findEntityOrFail: jest.fn() };
  const awsS3Service = { delete: jest.fn() };
  const deleteRouteService = {
    removeRoute: jest.fn(),
    removeRouteByEntity: jest.fn(),
  };
  const mediaItemProcessor = {
    findMediaItemsByTargetInTransaction: jest.fn(),
    deleteMediaItemsByTargetInTransaction: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: ImagePageDeleteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getService.findEntityOrFail.mockResolvedValue(
      buildPage([section('s1'), section('s2')]),
    );
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue(
      [],
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagePageDeleteService,
        { provide: ImagePageRepository, useValue: imagePageRepository },
        { provide: ImagePageGetService, useValue: getService },
        { provide: DeleteRouteService, useValue: deleteRouteService },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(ImagePageDeleteService);
  });

  it('remove mídias de todas as seções, a galeria e a rota; arquivos só depois do commit', async () => {
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockImplementation(
      (_manager: EntityManager, sectionId: string) =>
        Promise.resolve(
          sectionId === 's1'
            ? [media('a', true), media('link', false)]
            : [media('b', true)],
        ),
    );

    await service.removePage('page-id');

    expect(
      mediaItemProcessor.deleteMediaItemsByTargetInTransaction,
    ).toHaveBeenCalledWith(manager, 's1', 'ImagesPage');
    expect(
      mediaItemProcessor.deleteMediaItemsByTargetInTransaction,
    ).toHaveBeenCalledWith(manager, 's2', 'ImagesPage');
    expect(imagePageRepository.removePage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'page-id' }),
      manager,
    );
    expect(awsS3Service.delete).not.toHaveBeenCalled();
    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/a.png', 'https://s3/b.png'],
      expect.any(Function),
    );
    expect(deleteRouteService.removeRoute).toHaveBeenCalledWith('route-id');
  });

  it('remove por entidade quando a página não carrega a rota', async () => {
    getService.findEntityOrFail.mockResolvedValue({
      ...buildPage(),
      route: undefined,
    });

    await service.removePage('page-id');

    expect(deleteRouteService.removeRouteByEntity).toHaveBeenCalledWith(
      'ImagesPage',
      'page-id',
    );
  });

  it('propaga o not found de uma galeria inexistente', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Página de galeria não encontrada.',
    );
    getService.findEntityOrFail.mockRejectedValue(notFound);

    await expect(service.removePage('x')).rejects.toBe(notFound);
  });

  it('não apaga arquivo nem rota quando a remoção da galeria falha', async () => {
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue([
      media('a', true),
    ]);
    imagePageRepository.removePage.mockRejectedValue(new Error('db down'));

    await expect(service.removePage('page-id')).rejects.toBeInstanceOf(
      AppInternalException,
    );

    expect(
      mediaItemProcessor.discardUnreferencedUploads,
    ).not.toHaveBeenCalled();
    expect(awsS3Service.delete).not.toHaveBeenCalled();
    expect(deleteRouteService.removeRoute).not.toHaveBeenCalled();
  });
});
