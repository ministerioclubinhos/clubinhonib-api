import { Test } from '@nestjs/testing';

import { Weekday } from 'src/modules/clubs/entities/weekday.enum';

import { EventRepository } from '../repositories/event.repository';
import { ClubMeetingSource, ClubMeetingSummary } from '../types';
import { ReconcileClubEventsService } from './reconcile-club-events.service';
import { SyncClubEventService } from './sync-club-event.service';

const club = (
  id: string,
  overrides: Partial<ClubMeetingSource> = {},
): ClubMeetingSource => ({
  id,
  number: Number(id.replace(/\D/g, '')) || 1,
  weekday: Weekday.SATURDAY,
  time: '15:00',
  isActive: true,
  address: null,
  ...overrides,
});

/** O texto que o código produz hoje, para o número usado pelo `club()`. */
const textoAtual = (id: string) => ({
  title: `Dia do Clubinho ${Number(id.replace(/\D/g, '')) || 1}`,
  description: `Dia semanal do Clubinho ${Number(id.replace(/\D/g, '')) || 1}`,
});

const comDias = (clubId: string): ClubMeetingSummary => ({
  clubId,
  ...textoAtual(clubId),
});

describe('ReconcileClubEventsService', () => {
  const eventRepo = { findClubMeetingSummaries: jest.fn() };
  const syncClubEvent = {
    syncFromClub: jest.fn(),
    removeForClub: jest.fn(),
  };

  let service: ReconcileClubEventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    eventRepo.findClubMeetingSummaries.mockResolvedValue([]);
    syncClubEvent.syncFromClub.mockResolvedValue(null);
    syncClubEvent.removeForClub.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReconcileClubEventsService,
        { provide: EventRepository, useValue: eventRepo },
        { provide: SyncClubEventService, useValue: syncClubEvent },
      ],
    }).compile();

    service = moduleRef.get(ReconcileClubEventsService);
  });

  it('cria o encontro do clubinho ativo que está sem nenhum', async () => {
    const result = await service.reconcile([club('club-1')]);

    expect(syncClubEvent.syncFromClub).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(1);
  });

  it('não toca em clubinho que já tem encontro', async () => {
    // A proteção contra encontro duplicado: quem já está no calendário não é
    // recriado nem regravado.
    eventRepo.findClubMeetingSummaries.mockResolvedValue([comDias('club-1')]);

    const result = await service.reconcile([club('club-1')]);

    expect(syncClubEvent.syncFromClub).not.toHaveBeenCalled();
    expect(syncClubEvent.removeForClub).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      removed: 0,
      refreshed: 0,
      untouched: 1,
    });
  });

  it('tira os dias do clubinho que foi desativado', async () => {
    eventRepo.findClubMeetingSummaries.mockResolvedValue([comDias('club-1')]);

    const result = await service.reconcile([
      club('club-1', { isActive: false }),
    ]);

    expect(syncClubEvent.removeForClub).toHaveBeenCalledWith('club-1');
    expect(result.removed).toBe(1);
  });

  it('não mexe no clubinho inativo que já está sem dias', async () => {
    eventRepo.findClubMeetingSummaries.mockResolvedValue([]);

    const result = await service.reconcile([
      club('club-1', { isActive: false }),
    ]);

    expect(syncClubEvent.removeForClub).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      removed: 0,
      refreshed: 0,
      untouched: 1,
    });
  });

  it('não cria encontro para clubinho inativo que nunca teve um', async () => {
    const result = await service.reconcile([
      club('club-1', { isActive: false }),
    ]);

    expect(syncClubEvent.syncFromClub).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      removed: 0,
      refreshed: 0,
      untouched: 1,
    });
  });

  it('rodar de novo não cria nada', async () => {
    // Primeira execução cria; a segunda enxerga o encontro já no lugar.
    let created = false;
    eventRepo.findClubMeetingSummaries.mockImplementation(() =>
      Promise.resolve(created ? [comDias('club-1')] : []),
    );
    syncClubEvent.syncFromClub.mockImplementation(() => {
      created = true;
      return Promise.resolve(null);
    });

    const first = await service.reconcile([club('club-1')]);
    const second = await service.reconcile([club('club-1')]);

    expect(first.created).toBe(1);
    expect(second).toEqual({
      created: 0,
      removed: 0,
      refreshed: 0,
      untouched: 1,
    });
    expect(syncClubEvent.syncFromClub).toHaveBeenCalledTimes(1);
  });

  it('lê a situação de todos os clubinhos em uma consulta só', async () => {
    await service.reconcile([club('club-1'), club('club-2'), club('club-3')]);

    expect(eventRepo.findClubMeetingSummaries).toHaveBeenCalledTimes(1);
  });

  it('um clubinho com problema não impede os outros de entrar', async () => {
    // A corrida contra a unicidade de `club_id`, com duas instâncias subindo
    // ao mesmo tempo, chega aqui como erro de gravação — com a linha certa já
    // no banco, gravada pela outra instância.
    syncClubEvent.syncFromClub
      .mockRejectedValueOnce(
        new Error('Duplicate entry for key IDX_events_club_id'),
      )
      .mockResolvedValueOnce(null);

    const result = await service.reconcile([club('club-1'), club('club-2')]);

    expect(syncClubEvent.syncFromClub).toHaveBeenCalledTimes(2);
    expect(result.created).toBe(1);
  });

  it('atualiza o encontro com título antigo, sem criar outro', async () => {
    // O texto sai do número do clubinho. Mudá-lo no código não alcançaria as
    // linhas já gravadas: elas só seriam corrigidas na próxima edição do
    // clubinho, uma a uma.
    eventRepo.findClubMeetingSummaries.mockResolvedValue([
      { ...comDias('club-1'), title: 'Clubinho #1' },
    ]);

    const result = await service.reconcile([club('club-1')]);

    expect(syncClubEvent.syncFromClub).toHaveBeenCalledTimes(1);
    expect(result.refreshed).toBe(1);
    expect(result.created).toBe(0);
  });

  it('atualiza também quando só a descrição está antiga', async () => {
    eventRepo.findClubMeetingSummaries.mockResolvedValue([
      {
        ...comDias('club-1'),
        description: 'Encontro semanal do Clubinho #1.',
      },
    ]);

    const result = await service.reconcile([club('club-1')]);

    expect(result.refreshed).toBe(1);
  });

  it('não reescreve o encontro cujo texto já está certo', async () => {
    eventRepo.findClubMeetingSummaries.mockResolvedValue([comDias('club-1')]);

    const result = await service.reconcile([club('club-1')]);

    expect(syncClubEvent.syncFromClub).not.toHaveBeenCalled();
    expect(result.refreshed).toBe(0);
  });
});
