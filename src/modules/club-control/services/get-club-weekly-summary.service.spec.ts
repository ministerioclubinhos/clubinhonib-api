import { Test } from '@nestjs/testing';

import { UserRole } from 'src/core/auth/auth.types';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { ClubSimpleResponseDto } from 'src/modules/clubs/dto/club.response.dto';
import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import { GetClubsService } from 'src/modules/clubs/services/get-clubs.service';
import {
  AppForbiddenException,
  AppNotFoundException,
} from 'src/shared/exceptions';

import { ClubWeekStatus, ClubWeekTimeline } from '../constants';
import { ClubControlRepository } from '../repositories/club-control.repository';
import { AcademicWeekService } from './academic-week.service';
import { ClubStatusService } from './club-status.service';
import { GetClubWeeklySummaryService } from './get-club-weekly-summary.service';

/** Período curto de propósito: três semanas cabem numa asserção. */
const PERIOD = {
  id: 'period-1',
  year: 2026,
  startDate: '2026-03-02',
  endDate: '2026-03-21',
  isActive: true,
};

const club = (
  overrides: Partial<ClubSimpleResponseDto> = {},
): ClubSimpleResponseDto =>
  ({
    id: 'club-1',
    number: 12,
    weekday: Weekday.WEDNESDAY,
    time: '15:00',
    isActive: true,
    address: null,
    ...overrides,
  }) as ClubSimpleResponseDto;

const coordinatorContext = { role: UserRole.COORDINATOR, userId: 'user-1' };

describe('GetClubWeeklySummaryService', () => {
  const clubControlRepository = {
    findActivePeriods: jest.fn(),
    findPeriodByYear: jest.fn(),
    findActiveExceptions: jest.fn(),
    findSummaryChildrenByClubIds: jest.fn(),
    findSummaryPagelasByClubIds: jest.fn(),
  };
  const getClubsService = { findAllSimple: jest.fn() };
  const featureFlags = { isEnabled: jest.fn() };
  const clubStatusService = new ClubStatusService();

  let service: GetClubWeeklySummaryService;
  let academicWeekService: AcademicWeekService;

  beforeEach(async () => {
    jest.clearAllMocks();
    featureFlags.isEnabled.mockResolvedValue(true);
    clubControlRepository.findActivePeriods.mockResolvedValue([PERIOD]);
    clubControlRepository.findPeriodByYear.mockResolvedValue(PERIOD);
    clubControlRepository.findActiveExceptions.mockResolvedValue([]);
    clubControlRepository.findSummaryChildrenByClubIds.mockResolvedValue([]);
    clubControlRepository.findSummaryPagelasByClubIds.mockResolvedValue([]);
    getClubsService.findAllSimple.mockResolvedValue([club()]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetClubWeeklySummaryService,
        AcademicWeekService,
        { provide: ClubStatusService, useValue: clubStatusService },
        { provide: ClubControlRepository, useValue: clubControlRepository },
        { provide: GetClubsService, useValue: getClubsService },
        { provide: GetFeatureFlagsService, useValue: featureFlags },
      ],
    }).compile();

    service = moduleRef.get(GetClubWeeklySummaryService);
    academicWeekService = moduleRef.get(AcademicWeekService);

    // A semana corrente vem do relógio; fixá-la é o que torna o quadro
    // determinístico sem congelar o tempo do processo inteiro.
    jest
      .spyOn(academicWeekService, 'calculateCurrentAcademicWeek')
      .mockResolvedValue({
        academicYear: 2026,
        academicWeek: 2,
        isWithinPeriod: true,
        periodStartDate: PERIOD.startDate,
        periodEndDate: PERIOD.endDate,
      });
  });

  it('recusa quem chega com o recurso desligado para o perfil', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    await expect(
      service.getSummary(coordinatorContext, {}),
    ).rejects.toBeInstanceOf(AppForbiddenException);
    expect(getClubsService.findAllSimple).not.toHaveBeenCalled();
  });

  it('desenha uma linha por semana letiva do período', async () => {
    const summary = await service.getSummary(coordinatorContext, {});

    expect(summary.year).toBe(2026);
    expect(summary.currentWeek).toBe(2);
    expect(summary.period).toEqual({
      year: 2026,
      startDate: '2026-03-02',
      endDate: '2026-03-21',
      totalWeeks: 3,
    });
    expect(summary.weeks.map((week) => week.week)).toEqual([1, 2, 3]);
    expect(summary.weeks.map((week) => week.timeline)).toEqual([
      ClubWeekTimeline.Past,
      ClubWeekTimeline.Current,
      ClubWeekTimeline.Future,
    ]);
    // Segunda a sábado da primeira semana letiva.
    expect(summary.weeks[0].startDate).toBe('2026-03-02');
    expect(summary.weeks[0].endDate).toBe('2026-03-07');
  });

  it('conta a pagela lançada e a presença da semana', async () => {
    clubControlRepository.findSummaryChildrenByClubIds.mockResolvedValue([
      { childId: 'a', clubId: 'club-1', isActive: true, joinedAt: null },
      { childId: 'b', clubId: 'club-1', isActive: true, joinedAt: null },
    ]);
    clubControlRepository.findSummaryPagelasByClubIds.mockResolvedValue([
      { childId: 'a', clubId: 'club-1', week: 1, present: true },
    ]);

    const summary = await service.getSummary(coordinatorContext, {});
    const [primeira] = summary.weeks;

    expect(primeira.clubs[0].counts).toEqual({
      children: 2,
      childrenWithPagela: 1,
      childrenMissing: 1,
      childrenPresent: 1,
      completionRate: 50,
    });
    expect(primeira.clubs[0].status).toBe(ClubWeekStatus.Partial);
    expect(primeira.statusCounts.partial).toBe(1);
  });

  it('não cobra pagela de quem entrou depois do dia do clubinho', async () => {
    // A quarta-feira da semana 1 é 04/03; a criança entrou na semana seguinte.
    clubControlRepository.findSummaryChildrenByClubIds.mockResolvedValue([
      {
        childId: 'a',
        clubId: 'club-1',
        isActive: true,
        joinedAt: '2026-03-09',
      },
    ]);

    const summary = await service.getSummary(coordinatorContext, {});

    expect(summary.weeks[0].clubs[0].counts.children).toBe(0);
    expect(summary.weeks[1].clubs[0].counts.children).toBe(1);
  });

  it('marca o dia sem Clubinho com o motivo cadastrado', async () => {
    clubControlRepository.findActiveExceptions.mockResolvedValue([
      { exceptionDate: '2026-03-04', reason: 'Feriado', isRecurrent: false },
    ]);

    const summary = await service.getSummary(coordinatorContext, {});

    expect(summary.weeks[0].clubs[0].status).toBe(ClubWeekStatus.Exception);
    expect(summary.weeks[0].clubs[0].exceptionReason).toBe('Feriado');
  });

  it('clubinho desativado não recebe números a cobrar', async () => {
    getClubsService.findAllSimple.mockResolvedValue([
      club({ isActive: false }),
    ]);
    clubControlRepository.findSummaryChildrenByClubIds.mockResolvedValue([
      { childId: 'a', clubId: 'club-1', isActive: true, joinedAt: null },
    ]);

    const summary = await service.getSummary(coordinatorContext, {});

    expect(summary.weeks[0].clubs[0].status).toBe(ClubWeekStatus.Inactive);
    expect(summary.weeks[0].clubs[0].counts.children).toBe(0);
  });

  it('recorta um clubinho do conjunto que a sessão já enxergava', async () => {
    getClubsService.findAllSimple.mockResolvedValue([
      club(),
      { ...club(), id: 'club-2', number: 13 },
    ]);

    const summary = await service.getSummary(coordinatorContext, {
      clubId: 'club-2',
    });

    expect(summary.clubs.map((item) => item.clubId)).toEqual(['club-2']);
  });

  it('clubinho fora do alcance responde não encontrado', async () => {
    // Nunca uma lista vazia: a resposta é a mesma de um id inexistente.
    await expect(
      service.getSummary(coordinatorContext, { clubId: 'club-de-outro' }),
    ).rejects.toBeInstanceOf(AppNotFoundException);
  });

  it('ano sem período letivo devolve o contrato vazio, e não erro', async () => {
    clubControlRepository.findPeriodByYear.mockResolvedValue(null);

    const summary = await service.getSummary(coordinatorContext, {
      year: 2019,
    });

    expect(summary.year).toBe(2019);
    expect(summary.period).toBeNull();
    expect(summary.weeks).toEqual([]);
    expect(summary.clubs).toHaveLength(1);
    expect(summary.highlights.weeksElapsed).toBe(0);
  });

  it('lê o período em três consultas, não uma por célula', async () => {
    await service.getSummary(coordinatorContext, {});

    expect(
      clubControlRepository.findSummaryChildrenByClubIds,
    ).toHaveBeenCalledTimes(1);
    expect(
      clubControlRepository.findSummaryPagelasByClubIds,
    ).toHaveBeenCalledWith(['club-1'], 2026);
    expect(clubControlRepository.findActiveExceptions).toHaveBeenCalledTimes(1);
  });
});
