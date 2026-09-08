import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { ClubControlService } from 'src/modules/club-control/services/club-control.service';
import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import { EventRepository } from '../repositories/event.repository';
import { EventAudience, EventEntity } from '../entities/event.entity';
import { ClubMeetingScheduleService } from './club-meeting-schedule.service';
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

/** Encontro semanal de clubinho, que só existe dentro do período letivo. */
const buildClubMeeting = (id: string, date: string): EventEntity =>
  Object.assign(buildEvent(id, date), {
    isRecurring: true,
    weekday: Weekday.SATURDAY,
    clubId: `club-${id}`,
    public: false,
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
  // O controle é quem sabe o período letivo; a expansão em si roda de verdade,
  // que é o comportamento sob teste aqui.
  const clubControlService = { getCalendarRules: jest.fn() };

  let service: GetEventService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);
    mediaItemProcessor.findMediaItemByTarget.mockResolvedValue(null);
    clubControlService.getCalendarRules.mockResolvedValue({
      periods: [],
      exceptions: [],
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetEventService,
        ClubMeetingScheduleService,
        { provide: EventRepository, useValue: eventRepo },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: ClubControlService, useValue: clubControlService },
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

  describe('encontro de clubinho', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-12T15:00:00'));
      eventRepo.findAll.mockResolvedValue([
        buildClubMeeting('clubinho', '2026-03-07'),
      ]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('não vai para a agenda quando não há período letivo cadastrado', async () => {
      // A regra do admin: sem período letivo para o ano, não existe dia de
      // clubinho. Sem datas, o encontro não é devolvido.
      clubControlService.getCalendarRules.mockResolvedValue({
        periods: [],
        exceptions: [],
      });

      await expect(service.findAll(true)).resolves.toEqual([]);
    });

    it('repete todo sábado dentro do período letivo', async () => {
      clubControlService.getCalendarRules.mockResolvedValue({
        periods: [
          { year: 2026, startDate: '2026-03-07', endDate: '2026-04-04' },
        ],
        exceptions: [],
      });

      const [meeting] = await service.findAll(true);

      expect(meeting.occurrences).toEqual([
        '2026-03-07',
        '2026-03-14',
        '2026-03-21',
        '2026-03-28',
        '2026-04-04',
      ]);
    });

    it('pula os dias de exceção', async () => {
      clubControlService.getCalendarRules.mockResolvedValue({
        periods: [
          { year: 2026, startDate: '2026-03-07', endDate: '2026-03-28' },
        ],
        exceptions: [{ exceptionDate: '2026-03-21', isRecurrent: false }],
      });

      const [meeting] = await service.findAll(true);

      expect(meeting.occurrences).toEqual([
        '2026-03-07',
        '2026-03-14',
        '2026-03-28',
      ]);
    });

    it('respeita o recorte de datas pedido na consulta', async () => {
      // Sem recorte, um clubinho devolve uma data por semana de **cada**
      // período letivo cadastrado: com alguns anos no ar, a agenda inteira
      // carregaria centenas de datas por clubinho em toda chamada.
      clubControlService.getCalendarRules.mockResolvedValue({
        periods: [
          { year: 2026, startDate: '2026-03-07', endDate: '2026-12-12' },
        ],
        exceptions: [],
      });

      const [meeting] = await service.findAll(true, {
        from: '2026-04-01',
        to: '2026-04-30',
      });

      expect(meeting.occurrences).toEqual([
        '2026-04-04',
        '2026-04-11',
        '2026-04-18',
        '2026-04-25',
      ]);
    });

    it('não deixa o recorte fazer a agenda futura olhar para trás', async () => {
      clubControlService.getCalendarRules.mockResolvedValue({
        periods: [
          { year: 2026, startDate: '2026-03-07', endDate: '2026-12-12' },
        ],
        exceptions: [],
      });

      const [meeting] = await service.findUpcoming(true, {
        from: '2026-01-01',
        to: '2026-04-30',
      });

      // Hoje é 12/04/2026: nada anterior entra, mesmo pedido.
      expect(meeting.occurrences).toEqual(['2026-04-18', '2026-04-25']);
    });

    it('sai da agenda futura quando o ano letivo já terminou', async () => {
      // Antes, todo evento recorrente ficava para sempre em `/upcoming`: em
      // janeiro os clubinhos apareciam como se houvesse encontro na semana
      // seguinte.
      clubControlService.getCalendarRules.mockResolvedValue({
        periods: [
          { year: 2026, startDate: '2026-03-07', endDate: '2026-04-04' },
        ],
        exceptions: [],
      });
      jest.setSystemTime(new Date('2026-04-06T09:00:00'));

      await expect(service.findUpcoming(true)).resolves.toEqual([]);
    });
  });
});
