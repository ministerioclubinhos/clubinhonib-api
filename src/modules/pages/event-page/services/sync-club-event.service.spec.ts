import { Test } from '@nestjs/testing';
import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import { EventRepository } from '../repositories/event.repository';
import {
  EventAudience,
  EventEntity,
  EventType,
} from '../entities/event.entity';
import { ClubMeetingSource } from '../types';
import { SyncClubEventService } from './sync-club-event.service';

const club = (
  overrides: Partial<ClubMeetingSource> = {},
): ClubMeetingSource => ({
  id: 'club-1',
  number: 12,
  weekday: Weekday.WEDNESDAY,
  time: '15:00',
  isActive: true,
  address: {
    street: 'Rua das Flores',
    number: '100',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
  },
  ...overrides,
});

const storedEvent = (overrides: Partial<EventEntity> = {}): EventEntity =>
  Object.assign(new EventEntity(), {
    id: 'event-1',
    clubId: 'club-1',
    title: 'Dia do Clubinho 12',
    date: '2026-01-07',
    weekday: Weekday.WEDNESDAY,
    isRecurring: true,
    public: false,
    ...overrides,
  });

/** Data em `YYYY-MM-DD`, no fuso local, deslocada em dias a partir de hoje. */
const dayFromToday = (offset: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

describe('SyncClubEventService', () => {
  const eventRepo = {
    findByClubId: jest.fn(),
    createEvent: jest.fn(),
    saveEvent: jest.fn(),
    removeByClubId: jest.fn(),
  };

  let service: SyncClubEventService;

  beforeEach(async () => {
    jest.clearAllMocks();
    eventRepo.findByClubId.mockResolvedValue(null);
    eventRepo.createEvent.mockImplementation((content: unknown) =>
      Promise.resolve(Object.assign(new EventEntity(), content)),
    );
    eventRepo.saveEvent.mockImplementation((event: unknown) =>
      Promise.resolve(event),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncClubEventService,
        { provide: EventRepository, useValue: eventRepo },
      ],
    }).compile();

    service = moduleRef.get(SyncClubEventService);
  });

  it('cria o encontro semanal, não público e recorrente', async () => {
    await service.syncFromClub(club());

    expect(eventRepo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Dia do Clubinho 12',
        clubId: 'club-1',
        weekday: Weekday.WEDNESDAY,
        time: '15:00',
        isRecurring: true,
        public: false,
        audience: EventAudience.ALL,
        eventType: EventType.VISIT,
      }),
    );
  });

  it('cria o encontro mesmo sem período letivo cadastrado', async () => {
    // O serviço não consulta o período de propósito: a linha é a definição da
    // recorrência. Sem período, ela não produz nenhuma data — e passa a
    // produzir sozinha quando o período for cadastrado depois, sem job.
    await service.syncFromClub(club());

    expect(eventRepo.createEvent).toHaveBeenCalledTimes(1);
  });

  it('monta o local com o endereço do clubinho', async () => {
    await service.syncFromClub(club());

    const [[content]] = eventRepo.createEvent.mock.calls as [
      [{ location: string }],
    ];
    expect(content.location).toBe(
      'Rua das Flores, 100 · Centro · São Paulo - SP',
    );
  });

  it('usa o texto de reserva quando não há endereço', async () => {
    await service.syncFromClub(club({ address: null }));

    const [[content]] = eventRepo.createEvent.mock.calls as [
      [{ location: string }],
    ];
    expect(content.location).toBe('Endereço não informado');
  });

  it('aceita clubinho sem horário', async () => {
    await service.syncFromClub(club({ time: null }));

    expect(eventRepo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ time: null }),
    );
  });

  describe('quando já existe encontro do clubinho', () => {
    beforeEach(() => {
      eventRepo.findByClubId.mockResolvedValue(storedEvent());
    });

    it('atualiza a mesma linha, sem criar outra', async () => {
      await service.syncFromClub(
        club({ weekday: Weekday.FRIDAY, time: '16:30' }),
      );

      expect(eventRepo.createEvent).not.toHaveBeenCalled();
      expect(eventRepo.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'event-1',
          weekday: Weekday.FRIDAY,
          time: '16:30',
        }),
      );
    });

    it('preserva a data da primeira ocorrência ao mexer só no horário', async () => {
      await service.syncFromClub(club({ time: '16:30' }));

      expect(eventRepo.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-01-07' }),
      );
    });

    it('recomeça a série a partir de hoje quando o dia da semana muda', async () => {
      // A série inteira muda de dia: manter a data antiga faria o calendário
      // afirmar encontros de sexta que nunca existiram.
      await service.syncFromClub(club({ weekday: Weekday.FRIDAY }));

      const [[saved]] = eventRepo.saveEvent.mock.calls as [[EventEntity]];
      expect(saved.date >= dayFromToday(0)).toBe(true);
      expect(saved.date).not.toBe('2026-01-07');
    });
  });

  describe('quando o clubinho é desativado ou excluído', () => {
    it('desativar apaga todos os dias do calendário', async () => {
      await service.syncFromClub(club({ isActive: false }));

      expect(eventRepo.removeByClubId).toHaveBeenCalledWith('club-1');
      expect(eventRepo.createEvent).not.toHaveBeenCalled();
      expect(eventRepo.saveEvent).not.toHaveBeenCalled();
    });

    it('excluir o clubinho também apaga todos os dias', async () => {
      await service.removeForClub('club-1');

      expect(eventRepo.removeByClubId).toHaveBeenCalledWith('club-1');
    });

    it('desativar nem consulta a linha: ela vai embora de qualquer jeito', async () => {
      await service.syncFromClub(club({ isActive: false }));

      expect(eventRepo.findByClubId).not.toHaveBeenCalled();
    });

    it.each([
      ['o dia da semana', { weekday: Weekday.FRIDAY }],
      ['o horário', { time: '16:30' }],
      ['o número', { number: 99 }],
      ['o endereço', { address: null }],
    ])(
      'editar %s de um clubinho inativo não cria dia nenhum',
      async (_rotulo, alteracao) => {
        // Clubinho inativo não tem dia no calendário, e editar o cadastro dele
        // não é o mesmo que reativá-lo: quem devolve os dias é o botão de
        // ativar, não uma edição de horário.
        await service.syncFromClub(
          club({ isActive: false, ...alteracao } as Partial<ClubMeetingSource>),
        );

        expect(eventRepo.createEvent).not.toHaveBeenCalled();
        expect(eventRepo.saveEvent).not.toHaveBeenCalled();
        expect(eventRepo.removeByClubId).toHaveBeenCalledWith('club-1');
      },
    );

    it('reativar cria de novo, valendo a partir de hoje', async () => {
      // A desativação apagou a linha, então não há data antiga a preservar: o
      // clubinho volta ao calendário a partir do dia da reativação.
      eventRepo.findByClubId.mockResolvedValue(null);

      await service.syncFromClub(club());

      const [[content]] = eventRepo.createEvent.mock.calls as [
        [{ date: string }],
      ];
      expect(content.date >= dayFromToday(0)).toBe(true);
    });
  });

  it('não depende do serviço de avisos: encontro de clubinho não manda e-mail', () => {
    // O encontro é operacional e nasce de um cadastro administrativo; avisar
    // toda a base a cada clubinho cadastrado ou editado seria só ruído.
    const dependencies = Reflect.getMetadata(
      'design:paramtypes',
      SyncClubEventService,
    ) as unknown[];

    expect(dependencies).toHaveLength(1);
    expect(dependencies[0]).toBe(EventRepository);
  });
});
