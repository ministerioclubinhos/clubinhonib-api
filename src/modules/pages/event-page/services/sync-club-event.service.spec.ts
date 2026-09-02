import { Test } from '@nestjs/testing';
import { Weekday } from 'src/modules/clubs/enums/weekday.enum/weekday.enum';
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
    title: 'Clubinho #12',
    date: '2026-01-07',
    isRecurring: true,
    public: false,
    ...overrides,
  });

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
        title: 'Clubinho #12',
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

    it('preserva a data da primeira ocorrência', async () => {
      // Mudar o horário não deve alterar desde quando o encontro existe.
      await service.syncFromClub(club({ time: '16:30' }));

      expect(eventRepo.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-01-07' }),
      );
    });
  });

  it('tira o encontro do calendário quando o clubinho é desativado', async () => {
    await service.syncFromClub(club({ isActive: false }));

    expect(eventRepo.removeByClubId).toHaveBeenCalledWith('club-1');
    expect(eventRepo.createEvent).not.toHaveBeenCalled();
    expect(eventRepo.saveEvent).not.toHaveBeenCalled();
  });

  it('remove o encontro quando o clubinho sai', async () => {
    await service.removeForClub('club-1');

    expect(eventRepo.removeByClubId).toHaveBeenCalledWith('club-1');
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
