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
import { MeditationRepository } from '../repositories/meditation.repository';
import { MeditationEntity } from '../entities/meditation.entity';
import { GetMeditationService } from './get-meditation.service';
import { DeleteMeditationService } from './delete-meditation.service';

const meditation = Object.assign(new MeditationEntity(), {
  id: 'meditation-id',
  topic: 'Semana',
  startDate: '2026-08-31',
  endDate: '2026-09-04',
  days: [],
});

describe('DeleteMeditationService', () => {
  const manager = {} as EntityManager;
  // A transação passou a ser aberta pelo repositório.
  const meditationRepo = {
    removeMeditation: jest.fn(),
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
  };
  const getService = { findEntityOrFail: jest.fn() };
  const s3Service = { delete: jest.fn() };
  const deleteRouteService = { removeRouteByEntity: jest.fn() };
  const mediaItemProcessor = {
    findMediaItemsByTarget: jest.fn(),
    deleteMediaItems: jest.fn(),
  };

  let service: DeleteMeditationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getService.findEntityOrFail.mockResolvedValue(meditation);
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DeleteMeditationService,
        { provide: MeditationRepository, useValue: meditationRepo },
        { provide: GetMeditationService, useValue: getService },
        { provide: AwsS3Service, useValue: s3Service },
        { provide: DeleteRouteService, useValue: deleteRouteService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(DeleteMeditationService);
  });

  it('remove mídia, meditação e rota', async () => {
    const media = Object.assign(new MediaItemEntity(), {
      id: 'media-id',
      isLocalFile: true,
      url: 'https://s3/a.pdf',
    });
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([media]);

    await service.remove('meditation-id');

    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [media],
      expect.any(Function),
    );
    expect(meditationRepo.removeMeditation).toHaveBeenCalledWith(
      meditation,
      manager,
    );
    expect(deleteRouteService.removeRouteByEntity).toHaveBeenCalledWith(
      'Meditation',
      'meditation-id',
    );
  });

  it('não chama a exclusão de mídia quando não há nenhuma', async () => {
    await service.remove('meditation-id');

    expect(mediaItemProcessor.deleteMediaItems).not.toHaveBeenCalled();
    expect(meditationRepo.removeMeditation).toHaveBeenCalledTimes(1);
  });

  it('propaga o not found de uma meditação inexistente', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.MEDITATION_NOT_FOUND,
      'Meditação não encontrada',
    );
    getService.findEntityOrFail.mockRejectedValue(notFound);

    await expect(service.remove('x')).rejects.toBe(notFound);
  });

  it('embrulha falha inesperada de persistência', async () => {
    meditationRepo.removeMeditation.mockRejectedValue(new Error('db down'));

    await expect(service.remove('meditation-id')).rejects.toBeInstanceOf(
      AppInternalException,
    );
  });
});
