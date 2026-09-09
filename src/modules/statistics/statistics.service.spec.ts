import { Test } from '@nestjs/testing';

import { AcademicWeekService } from 'src/modules/club-control/services/academic-week.service';

import { AcceptedChristsStatisticsRepository } from './repositories/accepted-christs-statistics.repository';
import { AttendanceStatisticsRepository } from './repositories/attendance-statistics.repository';
import { ChildrenStatisticsRepository } from './repositories/children-statistics.repository';
import { ClubsTeachersStatisticsRepository } from './repositories/clubs-teachers-statistics.repository';
import { OverviewStatisticsRepository } from './repositories/overview-statistics.repository';
import { PagelasStatisticsRepository } from './repositories/pagelas-statistics.repository';
import { StatisticsPeriodService } from './services/statistics-period.service';
import { StatisticsService } from './statistics.service';
import { PagelasStatsQueryDto } from './dto/pagelas-stats-query.dto';

/**
 * Um dia fixo no meio do mês: com "hoje" no dia 12, o mês corrente tem 12 dias
 * e a janela móvel tem 30. Se as duas trocarem de lugar, os números da resposta
 * trocam junto — que é exatamente o que este teste tranca.
 */
const HOJE = new Date(2026, 8, 12, 10, 0, 0);

const overallStats = (totalPagelas: number) => ({
  totalPagelas,
  averagePresenceRate: 0,
  averageMeditationRate: 0,
  averageVerseRecitationRate: 0,
});

describe('StatisticsService.getOverviewStatistics', () => {
  /** Quantas pagelas cada janela devolve, para reconhecê-las na resposta. */
  const PAGELAS_POR_JANELA: Record<string, number> = {
    '2026-09-01': 12, // do primeiro dia do mês até hoje
    '2026-08-14': 30, // trinta dias corridos
    '2026-09-06': 7, // sete dias corridos
    '2026-08-03': 41, // seis semanas
  };

  const pagelasRepository = {
    getPagelasOverallStats: jest.fn(),
    getPagelasWeeklyStats: jest.fn(),
  };
  const overviewRepository = {
    getTotalCounts: jest.fn(),
    getActiveCountsThisMonth: jest.fn(),
    getClubsPerformanceMetrics: jest.fn(),
    getChildrenEngagementMetrics: jest.fn(),
    getChildrenGenderDistribution: jest.fn(),
    getGeographicDistribution: jest.fn(),
    getChildrenCountAt: jest.fn(),
    getAcceptedChristsCountBefore: jest.fn(),
    getAcceptedChristsCountBetween: jest.fn(),
  };
  const acceptedChristsRepository = {
    getAcceptedChristsOverallStats: jest.fn(),
    getAcceptedChristsByPeriod: jest.fn(),
  };
  const childrenRepository = {
    getTopEngagedChildren: jest.fn(),
    getClubRankings: jest.fn(),
  };
  const academicWeekService = { calculateCurrentAcademicWeek: jest.fn() };

  let service: StatisticsService;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(HOJE);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    pagelasRepository.getPagelasOverallStats.mockImplementation(
      (filters: PagelasStatsQueryDto) =>
        Promise.resolve(
          overallStats(PAGELAS_POR_JANELA[filters.startDate ?? ''] ?? 0),
        ),
    );
    pagelasRepository.getPagelasWeeklyStats.mockResolvedValue([]);
    overviewRepository.getTotalCounts.mockResolvedValue({
      totalChildren: 0,
      totalClubs: 0,
      totalTeachers: 0,
      inactiveChildren: 0,
      inactiveClubs: 0,
    });
    overviewRepository.getActiveCountsThisMonth.mockResolvedValue({
      activeChildren: 0,
      activeTeachers: 0,
    });
    overviewRepository.getClubsPerformanceMetrics.mockResolvedValue({
      avgPerformanceScore: 0,
      avgPresenceRate: 0,
      clubsWithoutPagelas: 0,
    });
    overviewRepository.getChildrenEngagementMetrics.mockResolvedValue({
      avgEngagementScore: 0,
      avgPresenceRate: 0,
      childrenWithoutPagelas: 0,
      childrenAtRisk: 0,
    });
    overviewRepository.getChildrenGenderDistribution.mockResolvedValue({
      male: 0,
      female: 0,
    });
    overviewRepository.getGeographicDistribution.mockResolvedValue({
      byState: [],
      topCities: [],
    });
    overviewRepository.getChildrenCountAt.mockResolvedValue(0);
    overviewRepository.getAcceptedChristsCountBefore.mockResolvedValue(0);
    overviewRepository.getAcceptedChristsCountBetween.mockResolvedValue(0);
    acceptedChristsRepository.getAcceptedChristsOverallStats.mockResolvedValue({
      totalDecisions: 0,
      byDecisionType: {},
    });
    acceptedChristsRepository.getAcceptedChristsByPeriod.mockResolvedValue([]);
    childrenRepository.getTopEngagedChildren.mockResolvedValue([]);
    childrenRepository.getClubRankings.mockResolvedValue([]);
    // Fora do período letivo: o "esta semana" não interfere nas duas janelas
    // que este teste observa.
    academicWeekService.calculateCurrentAcademicWeek.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: PagelasStatisticsRepository, useValue: pagelasRepository },
        { provide: OverviewStatisticsRepository, useValue: overviewRepository },
        {
          provide: AcceptedChristsStatisticsRepository,
          useValue: acceptedChristsRepository,
        },
        { provide: ChildrenStatisticsRepository, useValue: childrenRepository },
        { provide: AttendanceStatisticsRepository, useValue: {} },
        { provide: ClubsTeachersStatisticsRepository, useValue: {} },
        { provide: StatisticsPeriodService, useValue: {} },
        { provide: AcademicWeekService, useValue: academicWeekService },
      ],
    }).compile();

    service = moduleRef.get(StatisticsService);
  });

  it('"este mês" conta do primeiro dia do mês, não os últimos 30 dias', async () => {
    const overview = await service.getOverviewStatistics();

    expect(overview.pagelas?.thisMonth.total).toBe(12);
  });

  it('"últimos 30 dias" conta a janela móvel, não o mês corrente', async () => {
    const overview = await service.getOverviewStatistics();

    expect(overview.engagement?.recentActivity.last30Days).toBe(30);
  });

  it('guarda o panorama por um minuto em vez de refazer trinta consultas', async () => {
    await service.getOverviewStatistics();
    const primeiraRodada = overviewRepository.getTotalCounts.mock.calls.length;

    await service.getOverviewStatistics();
    expect(overviewRepository.getTotalCounts).toHaveBeenCalledTimes(
      primeiraRodada,
    );

    // Passado o prazo, a conta é refeita.
    jest.setSystemTime(new Date(HOJE.getTime() + 61_000));
    await service.getOverviewStatistics();
    expect(overviewRepository.getTotalCounts).toHaveBeenCalledTimes(
      primeiraRodada + 1,
    );
    jest.setSystemTime(HOJE);
  });

  it('sete e trinta dias não podem empatar no meio do mês', async () => {
    // Era o sintoma visível da troca: as duas caixas mostravam o mesmo número.
    const overview = await service.getOverviewStatistics();

    expect(overview.engagement?.recentActivity.last7Days).toBe(7);
    expect(overview.engagement?.recentActivity.last30Days).not.toBe(
      overview.engagement?.recentActivity.last7Days,
    );
  });
});
