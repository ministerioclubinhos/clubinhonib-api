import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { EventRepository } from '../repositories/event.repository';
import { EventAudience, EventEntity } from '../entities/event.entity';
import { GetEventService } from './get-event.service';

const buildEvent = (id: string, date: string): EventEntity =>
  Object.assign(new EventEntity(), {
    id,
    title: `Evento ${id}`,
    date,
    location: 'Salão',
    description: '',
    audience: EventAudience.ALL,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const media = (targetId: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id: `media-${targetId}`,
    targetId,
    url: 'https://s3/a.png',
    isLocalFile: true,
  });

describe('GetEventService', () => {
  const eventRepo = { findAll: jest.fn(), findById: jest.fn() };
  const mediaItemProcessor = {
    findMediaItemByTarget: jest.fn(),
    findManyMediaItemsByTargets: jest.fn(),
  };

  let service: GetEventService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);
    mediaItemProcessor.findMediaItemByTarget.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetEventService,
        { provide: EventRepository, useValue: eventRepo },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(GetEventService);
  });

  it('lista os eventos buscando as mídias em uma consulta só', async () => {
    eventRepo.findAll.mockResolvedValue([
      buildEvent('a', '2026-04-12'),
      buildEvent('b', '2026-05-20'),
    ]);
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([
      media('b'),
    ]);

    const result = await service.findAll(true);

    expect(
      mediaItemProcessor.findManyMediaItemsByTargets,
    ).toHaveBeenCalledTimes(1);
    expect(result[0].media).toBeNull();
    expect(result[1].media?.id).toBe('media-b');
  });

  it('devolve lista vazia sem consultar mídia', async () => {
    eventRepo.findAll.mockResolvedValue([]);

    await expect(service.findAll(true)).resolves.toEqual([]);
    expect(
      mediaItemProcessor.findManyMediaItemsByTargets,
    ).not.toHaveBeenCalled();
  });

  it('falha quando o evento não existe', async () => {
    eventRepo.findById.mockResolvedValue(null);

    await expect(service.findOne('x')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  describe('agenda futura', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-12T15:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('mantém o evento de hoje e descarta o que já passou', async () => {
      // A data é texto: comparar com `new Date(string)` traria o fuso junto e
      // o evento de hoje sumiria da agenda em qualquer fuso negativo.
      eventRepo.findAll.mockResolvedValue([
        buildEvent('ontem', '2026-04-11'),
        buildEvent('hoje', '2026-04-12'),
        buildEvent('amanha', '2026-04-13'),
      ]);

      const result = await service.findUpcoming(true);

      expect(result.map((event) => event.id)).toEqual(['hoje', 'amanha']);
    });

    it('entende data em formato ISO completo', async () => {
      eventRepo.findAll.mockResolvedValue([
        buildEvent('hoje', '2026-04-12T00:00:00.000Z'),
      ]);

      const result = await service.findUpcoming(true);

      expect(result).toHaveLength(1);
    });
  });
});
