import { Test } from '@nestjs/testing';

import { ReconcileClubEventsService } from 'src/modules/pages/event-page/services/reconcile-club-events.service';

import { ClubsRepository } from '../repositories/clubs.repository';
import { Weekday } from '../entities/weekday.enum';
import { BackfillClubEventsService } from './backfill-club-events.service';

const club = (overrides: Record<string, unknown> = {}) => ({
  id: 'club-1',
  number: 12,
  weekday: Weekday.SATURDAY,
  time: '15:00',
  isActive: true,
  address: { street: 'Rua das Flores' },
  ...overrides,
});

describe('BackfillClubEventsService', () => {
  const clubsRepository = { findAllSimple: jest.fn() };
  const reconcileService = { reconcile: jest.fn() };

  let service: BackfillClubEventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    clubsRepository.findAllSimple.mockResolvedValue([club()]);
    reconcileService.reconcile.mockResolvedValue({
      created: 0,
      removed: 0,
      refreshed: 0,
      untouched: 1,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        BackfillClubEventsService,
        { provide: ClubsRepository, useValue: clubsRepository },
        { provide: ReconcileClubEventsService, useValue: reconcileService },
      ],
    }).compile();

    service = moduleRef.get(BackfillClubEventsService);
  });

  it('reconcilia na subida da aplicação', async () => {
    await service.onApplicationBootstrap();

    expect(reconcileService.reconcile).toHaveBeenCalledTimes(1);
  });

  /**
   * O ponto que motivou o teste.
   *
   * A reconciliação já esteve atrás de `SCHEDULER_ENABLED`, e o efeito foi que
   * o ambiente sem a chave — o dev — ficava sem ela: os dias de clubinho
   * seguiam com o título antigo até alguém editar cada clubinho. E ligar a
   * chave lá tem preço: ela também liga os jobs de e-mail, que passariam a
   * cobrar pagela de professor de verdade a partir do dev.
   */
  it('não depende de nenhuma variável de ambiente', () => {
    const dependencias = Reflect.getMetadata(
      'design:paramtypes',
      BackfillClubEventsService,
    ) as unknown[];

    expect(dependencias).toEqual([ClubsRepository, ReconcileClubEventsService]);
  });

  it('leva todos os clubinhos, inclusive os inativos', async () => {
    // São os inativos que podem ter dias sobrando no calendário; pedir só os
    // ativos deixaria esse conserto de fora.
    await service.onApplicationBootstrap();

    expect(clubsRepository.findAllSimple).toHaveBeenCalledWith();
  });

  it('a aplicação sobe mesmo se a reconciliação falhar', async () => {
    // Um calendário incompleto é bem menos grave do que o serviço fora do ar.
    reconcileService.reconcile.mockRejectedValue(new Error('banco fora'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('a aplicação sobe mesmo se a leitura dos clubinhos falhar', async () => {
    clubsRepository.findAllSimple.mockRejectedValue(new Error('banco fora'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(reconcileService.reconcile).not.toHaveBeenCalled();
  });
});
