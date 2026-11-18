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
    findAllPaginated: jest.fn(),
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

  describe('findAllPaginated', () => {
    it('carrega a mídia de toda a página em uma consulta', async () => {
      meditationRepo.findAllPaginated.mockResolvedValue({
        items: [buildMeditation('a'), buildMeditation('b')],
        total: 2,
      });
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
        buildMedia('a'),
      ]);

      const result = await service.findAllPaginated({ page: 1, limit: 12 });

      expect(
        mediaItemProcessor.findManyMediaItemsByTargets,
      ).toHaveBeenCalledTimes(1);
      expect(result.data[0].media?.id).toBe('media-a');
      expect(result.data[1].media).toBeNull();
    });

    it('devolve o envelope paginado com o total do banco', async () => {
      meditationRepo.findAllPaginated.mockResolvedValue({
        items: [buildMeditation('a')],
        total: 25,
      });
      mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

      const result = await service.findAllPaginated({ page: 2, limit: 12 });

      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(12);
      expect(result.pageCount).toBe(3);
    });

    it('repassa a data de hoje para o filtro de período', async () => {
      meditationRepo.findAllPaginated.mockResolvedValue({
        items: [],
        total: 0,
      });

      await service.findAllPaginated({ period: 'current' });

      const [, today] = meditationRepo.findAllPaginated.mock.calls[0] as [
        unknown,
        string,
      ];
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('não consulta mídia quando a página está vazia', async () => {
      meditationRepo.findAllPaginated.mockResolvedValue({
        items: [],
        total: 0,
      });

      await expect(service.findAllPaginated({})).resolves.toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 12,
        pageCount: 0,
      });
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
      expect(meditationRepo.findAllPaginated).not.toHaveBeenCalled();
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
