import { Test } from '@nestjs/testing';

import { GetClubRecipientsService } from 'src/modules/clubs/services/get-club-recipients.service';
import { ResolvePagelaWeekService } from 'src/modules/pagelas/services/resolve-pagela-week.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { ClubWeekStatus } from '../constants';
import { ClubWeekPendency } from '../types';
import { ClubControlService } from './club-control.service';
import { NotifyMissingPagelaService } from './notify-missing-pagela.service';

const SATURDAY = new Date(2026, 3, 11);

const pendency = (
  overrides: Partial<ClubWeekPendency> = {},
): ClubWeekPendency => ({
  clubId: 'club-1',
  clubNumber: 12,
  status: ClubWeekStatus.Partial,
  expectedDate: '2026-04-08',
  totalChildren: 10,
  withPagela: 7,
  missing: [{ childId: 'child-1', childName: 'Joana' }],
  ...overrides,
});

const teacher = { id: 'teacher-1', name: 'Ana', email: 'ana@exemplo.com' };
const coordinator = { id: 'coord-1', name: 'Bia', email: 'bia@exemplo.com' };

describe('NotifyMissingPagelaService', () => {
  const clubControlService = { listClubsWithMissingPagela: jest.fn() };
  const resolvePagelaWeekService = { resolve: jest.fn() };
  const getClubRecipientsService = { forClubs: jest.fn() };
  const emailService = { sendMissingPagelaReminder: jest.fn() };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]): string =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: NotifyMissingPagelaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendMissingPagelaReminder.mockResolvedValue({
      recipients: 2,
      sent: 2,
      failed: 0,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotifyMissingPagelaService,
        { provide: ClubControlService, useValue: clubControlService },
        {
          provide: ResolvePagelaWeekService,
          useValue: resolvePagelaWeekService,
        },
        {
          provide: GetClubRecipientsService,
          useValue: getClubRecipientsService,
        },
        { provide: EmailService, useValue: emailService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(NotifyMissingPagelaService);
  });

  /** Férias, recesso, a virada de um ano letivo para o outro. */
  it('não envia nada quando a semana está fora do período letivo', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue(null);

    const notified = await service.notifyForWeekOf(SATURDAY);

    expect(notified).toBe(0);
    expect(
      clubControlService.listClubsWithMissingPagela,
    ).not.toHaveBeenCalled();
    expect(emailService.sendMissingPagelaReminder).not.toHaveBeenCalled();
  });

  it('não envia nada quando nenhum clubinho ficou pendente', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue({ year: 2026, week: 8 });
    clubControlService.listClubsWithMissingPagela.mockResolvedValue([]);

    const notified = await service.notifyForWeekOf(SATURDAY);

    expect(notified).toBe(0);
    expect(emailService.sendMissingPagelaReminder).not.toHaveBeenCalled();
  });

  it('avisa professores e coordenador do clubinho pendente', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue({ year: 2026, week: 8 });
    clubControlService.listClubsWithMissingPagela.mockResolvedValue([
      pendency(),
    ]);
    getClubRecipientsService.forClubs.mockResolvedValue(
      new Map([
        [
          'club-1',
          {
            clubId: 'club-1',
            clubNumber: 12,
            teachers: [teacher],
            coordinator,
          },
        ],
      ]),
    );

    const notified = await service.notifyForWeekOf(SATURDAY);

    expect(notified).toBe(1);
    expect(emailService.sendMissingPagelaReminder).toHaveBeenCalledWith(
      [teacher, coordinator],
      expect.objectContaining({
        clubNumber: 12,
        academicWeek: 8,
        academicYear: 2026,
        missing: [{ childId: 'child-1', childName: 'Joana' }],
        pagelasLink: 'https://clubinhonib.com/adm/pagelas',
      }),
    );
  });

  /** Sem professor nem coordenador elegível não há a quem cobrar. */
  it('pula o clubinho sem destinatário', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue({ year: 2026, week: 8 });
    clubControlService.listClubsWithMissingPagela.mockResolvedValue([
      pendency(),
    ]);
    getClubRecipientsService.forClubs.mockResolvedValue(
      new Map([
        [
          'club-1',
          { clubId: 'club-1', clubNumber: 12, teachers: [], coordinator: null },
        ],
      ]),
    );

    const notified = await service.notifyForWeekOf(SATURDAY);

    expect(notified).toBe(0);
    expect(emailService.sendMissingPagelaReminder).not.toHaveBeenCalled();
  });

  /** O lembrete de um clubinho não depende do outro. */
  it('segue com os demais quando um envio falha', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue({ year: 2026, week: 8 });
    clubControlService.listClubsWithMissingPagela.mockResolvedValue([
      pendency({ clubId: 'club-1', clubNumber: 12 }),
      pendency({ clubId: 'club-2', clubNumber: 13 }),
    ]);
    getClubRecipientsService.forClubs.mockResolvedValue(
      new Map([
        [
          'club-1',
          {
            clubId: 'club-1',
            clubNumber: 12,
            teachers: [teacher],
            coordinator: null,
          },
        ],
        [
          'club-2',
          {
            clubId: 'club-2',
            clubNumber: 13,
            teachers: [teacher],
            coordinator: null,
          },
        ],
      ]),
    );
    emailService.sendMissingPagelaReminder
      .mockRejectedValueOnce(new Error('SMTP fora'))
      .mockResolvedValueOnce({ recipients: 1, sent: 1, failed: 0 });

    const notified = await service.notifyForWeekOf(SATURDAY);

    expect(notified).toBe(1);
    expect(emailService.sendMissingPagelaReminder).toHaveBeenCalledTimes(2);
  });

  /**
   * A data vai em horário local: `toISOString` adiantaria o dia depois das 21h
   * em São Paulo e resolveria a semana errada.
   */
  it('resolve a semana pela data local do sábado', async () => {
    resolvePagelaWeekService.resolve.mockResolvedValue(null);

    await service.notifyForWeekOf(new Date(2026, 3, 11, 22, 30));

    expect(resolvePagelaWeekService.resolve).toHaveBeenCalledWith(
      '2026-04-11',
      false,
    );
  });
});
