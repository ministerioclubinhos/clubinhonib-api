import { Test } from '@nestjs/testing';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { GetCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/get-coordinator-profiles.service';
import { CoordinatorProfileEntity } from 'src/modules/coordinator-profiles/entities/coordinator-profile.entity/coordinator-profile.entity';
import { ResolvePagelaWeekService } from 'src/modules/pagelas/services/resolve-pagela-week.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { ClubWeekStatus } from '../constants';
import { ClubControlService } from './club-control.service';
import { NotifyCoordinatorSummaryService } from './notify-coordinator-summary.service';

const SATURDAY = new Date(2026, 3, 11);

const recipient = { id: 'user-1', name: 'Bia', email: 'bia@exemplo.com' };

const coordinator = (clubIds: string[]): CoordinatorProfileEntity =>
  ({
    id: 'coord-1',
    user: { id: 'user-1' },
    clubs: clubIds.map((id, index) => ({ id, number: 12 + index })),
  }) as CoordinatorProfileEntity;

describe('NotifyCoordinatorSummaryService', () => {
  const clubControlService = { listClubsWithMissingPagela: jest.fn() };
  const resolvePagelaWeekService = { resolve: jest.fn() };
  const getCoordinatorProfilesService = { findAllActiveWithClubs: jest.fn() };
  const getUsersService = { findNoticeRecipientsByIds: jest.fn() };
  const emailService = { sendCoordinatorWeeklySummary: jest.fn() };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]): string =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: NotifyCoordinatorSummaryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendCoordinatorWeeklySummary.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotifyCoordinatorSummaryService,
        { provide: ClubControlService, useValue: clubControlService },
        {
          provide: ResolvePagelaWeekService,
          useValue: resolvePagelaWeekService,
        },
        {
          provide: GetCoordinatorProfilesService,
          useValue: getCoordinatorProfilesService,
        },
        { provide: GetUsersService, useValue: getUsersService },
        { provide: EmailService, useValue: emailService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(NotifyCoordinatorSummaryService);
  });

  it('não envia nada fora do período letivo', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue(null);

    expect(await service.notifyForWeekOf(SATURDAY)).toBe(0);
    expect(emailService.sendCoordinatorWeeklySummary).not.toHaveBeenCalled();
  });

  /** Cada coordenador recebe só o recorte dos clubinhos dele. */
  it('manda a cada coordenador as pendências dos seus clubinhos', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue({ year: 2026, week: 8 });
    getCoordinatorProfilesService.findAllActiveWithClubs.mockResolvedValue([
      coordinator(['club-1', 'club-2']),
    ]);
    getUsersService.findNoticeRecipientsByIds.mockResolvedValue([recipient]);
    clubControlService.listClubsWithMissingPagela.mockResolvedValue([
      {
        clubId: 'club-1',
        clubNumber: 12,
        status: ClubWeekStatus.Partial,
        expectedDate: '2026-04-08',
        totalChildren: 10,
        withPagela: 7,
        missing: [{ childId: 'c1', childName: 'Joana' }],
      },
      // De outro coordenador: não pode aparecer no resumo deste.
      {
        clubId: 'club-99',
        clubNumber: 99,
        status: ClubWeekStatus.Missing,
        expectedDate: '2026-04-08',
        totalChildren: 5,
        withPagela: 0,
        missing: [],
      },
    ]);

    const sent = await service.notifyForWeekOf(SATURDAY);

    expect(sent).toBe(1);
    expect(emailService.sendCoordinatorWeeklySummary).toHaveBeenCalledWith(
      recipient,
      expect.objectContaining({
        academicWeek: 8,
        clubs: [
          {
            clubNumber: 12,
            status: 'Pagelas faltando',
            totalChildren: 10,
            withPagela: 7,
            missing: 1,
          },
        ],
        // Dois clubes, um pendente.
        clubsOk: 1,
        panelLink: 'https://clubinhonib.com/adm/controle-clubinhos',
      }),
    );
  });

  /** "Tudo em dia" é informação, não silêncio. */
  it('manda o resumo mesmo sem nenhuma pendência', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue({ year: 2026, week: 8 });
    getCoordinatorProfilesService.findAllActiveWithClubs.mockResolvedValue([
      coordinator(['club-1']),
    ]);
    getUsersService.findNoticeRecipientsByIds.mockResolvedValue([recipient]);
    clubControlService.listClubsWithMissingPagela.mockResolvedValue([]);

    const sent = await service.notifyForWeekOf(SATURDAY);

    expect(sent).toBe(1);
    expect(emailService.sendCoordinatorWeeklySummary).toHaveBeenCalledWith(
      recipient,
      expect.objectContaining({ clubs: [], clubsOk: 1 }),
    );
  });

  /** A régua de elegibilidade continua sendo a do módulo de usuário. */
  it('pula o coordenador que não pode receber avisos', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue({ year: 2026, week: 8 });
    getCoordinatorProfilesService.findAllActiveWithClubs.mockResolvedValue([
      coordinator(['club-1']),
    ]);
    getUsersService.findNoticeRecipientsByIds.mockResolvedValue([]);
    clubControlService.listClubsWithMissingPagela.mockResolvedValue([]);

    expect(await service.notifyForWeekOf(SATURDAY)).toBe(0);
    expect(emailService.sendCoordinatorWeeklySummary).not.toHaveBeenCalled();
  });

  /** O levantamento é caro: quatro consultas por clubinho. */
  it('levanta a semana uma vez só para todos os coordenadores', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue({ year: 2026, week: 8 });
    getCoordinatorProfilesService.findAllActiveWithClubs.mockResolvedValue([
      coordinator(['club-1']),
      coordinator(['club-2']),
    ]);
    getUsersService.findNoticeRecipientsByIds.mockResolvedValue([recipient]);
    clubControlService.listClubsWithMissingPagela.mockResolvedValue([]);

    await service.notifyForWeekOf(SATURDAY);

    expect(clubControlService.listClubsWithMissingPagela).toHaveBeenCalledTimes(
      1,
    );
  });
});
