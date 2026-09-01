import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MeditationRepository } from '../repositories/meditation.repository';
import { MeditationEntity } from '../entities/meditation.entity';
import { DayEntity, WeekDay } from '../entities/day.entity';
import { GetMeditationService } from './get-meditation.service';

const buildMeditation = (id: string): MeditationEntity =>
  Object.assign(new MeditationEntity(), {
    id,
    topic: `Meditação ${id}`,
    startDate: '2026-08-31',
    endDate: '2026-09-04',
    days: [
      Object.assign(new DayEntity(), {
        id: `${id}-monday`,
        day: WeekDay.Monday,
        verse: 'Sl 1',
        topic: 'Tema',
      }),
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const buildMedia = (targetId: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id: `media-${targetId}`,
    title: 'Material',
    description: '',
    mediaType: MediaType.DOCUMENT,
    uploadType: UploadType.LINK,
    url: 'https://example.com/a.pdf',
    isLocalFile: false,
    targetId,
    targetType: 'Meditation',
  });

describe('GetMeditationService', () => {
  const meditationRepo = {
    findAllWithDays: jest.fn(),
    findOneWithDays: jest.fn(),
    findByDate: jest.fn(),
  };
  const mediaItemProcessor = {
    findMediaItemByTarget: jest.fn(),
    findMediaItemsByTarget: jest.fn(),
    findManyMediaItemsByTargets: jest.fn(),
  };

  let service: GetMeditationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetMeditationService,
        { provide: MeditationRepository, useValue: meditationRepo },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(GetMeditationService);
  });

  describe('findEntityOrFail', () => {
    it('falha com o erro documentado quando não existe', async () => {
      meditationRepo.findOneWithDays.mockResolvedValue(null);

      await expect(service.findEntityOrFail('x')).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('carrega a mídia de todas as meditações em uma consulta', async () => {
      meditationRepo.findAllWithDays.mockResolvedValue([
        buildMeditation('a'),
        buildMeditation('b'),
      ]);
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
        buildMedia('a'),
      ]);

      const result = await service.findAll();

      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).toHaveBeenCalledTimes(1);
      expect(result[0].media?.id).toBe('media-a');
      expect(result[1].media).toBeNull();
    });

    it('não consulta mídia quando não há meditação', async () => {
      meditationRepo.findAllWithDays.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual([]);
      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getThisWeekMeditation', () => {
    it('busca pela data no banco, sem varrer a tabela', async () => {
      meditationRepo.findByDate.mockResolvedValue(buildMeditation('a'));
      mediaItemProcessor.findMediaItemByTarget.mockResolvedValue(
        buildMedia('a'),
      );

      const result = await service.getThisWeekMeditation();

      expect(meditationRepo.findByDate).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
      expect(meditationRepo.findAllWithDays).not.toHaveBeenCalled();
      expect(result?.id).toBe('a');
    });

    it('devolve a meditação mesmo sem mídia associada', async () => {
      // A meditação da semana sumia inteira quando faltava a mídia, levando
      // junto as rotas dos dias que dependem dela.
      meditationRepo.findByDate.mockResolvedValue(buildMeditation('a'));
      mediaItemProcessor.findMediaItemByTarget.mockResolvedValue(null);

      const result = await service.getThisWeekMeditation();

      expect(result).not.toBeNull();
      expect(result?.id).toBe('a');
      expect(result?.media).toBeNull();
      expect(result?.days).toHaveLength(1);
    });

    it('devolve null quando nenhuma meditação cobre a data', async () => {
      meditationRepo.findByDate.mockResolvedValue(null);

      await expect(service.getThisWeekMeditation()).resolves.toBeNull();
    });
  });
});
