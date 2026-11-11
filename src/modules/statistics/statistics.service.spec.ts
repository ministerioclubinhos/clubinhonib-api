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
    getActiveCounts: jest.fn(),
    countClubsWithLowAttendance: jest.fn(),
    getChildrenEngagementMetrics: jest.fn(),
    getChildrenGenderDistribution: jest.fn(),
    getGeographicDistribution: jest.fn(),
    getChildrenCountAt: jest.fn(),
  };
  const attendanceRepository = { analyzeWeeklyAttendance: jest.fn() };
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
    overviewRepository.getActiveCounts.mockResolvedValue({
      activeChildren: 0,
      activeTeachers: 0,
    });
    overviewRepository.countClubsWithLowAttendance.mockResolvedValue(0);
    overviewRepository.getChildrenEngagementMetrics.mockResolvedValue({
      avgEngagementScore: 0,
      childrenWithLowEngagement: 0,
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
        {
          provide: AttendanceStatisticsRepository,
          useValue: attendanceRepository,
        },
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

  describe('clubinhos sem pagela na semana', () => {
    it('fora do período letivo o indicador é 0 e não consulta semana nenhuma', async () => {
      // Era o defeito: a semana do calendário civil (37) era comparada com a
      // semana letiva da pagela, nunca batia, e todo clubinho ativo aparecia
      // como "sem pagela".
      const overview = await service.getOverviewStatistics();

      expect(overview.indicators?.clubsMissingPagelas).toBe(0);
      expect(overview.indicators?.currentAcademicWeek).toBeNull();
      expect(
        attendanceRepository.analyzeWeeklyAttendance,
      ).not.toHaveBeenCalled();
    });

    it('dentro do período usa a semana letiva e a análise de frequência semanal', async () => {
      academicWeekService.calculateCurrentAcademicWeek.mockResolvedValue({
        academicYear: 2026,
        academicWeek: 28,
        isWithinPeriod: true,
        periodStartDate: '2026-03-02',
        periodEndDate: '2026-12-19',
      });
      attendanceRepository.analyzeWeeklyAttendance.mockResolvedValue({
        summary: { clubsMissing: 3 },
      });

      const overview = await service.getOverviewStatistics();

      expect(attendanceRepository.analyzeWeeklyAttendance).toHaveBeenCalledWith(
        2026,
        28,
      );
      expect(overview.indicators?.clubsMissingPagelas).toBe(3);
      expect(overview.indicators?.currentAcademicWeek).toEqual({
        year: 2026,
        week: 28,
      });
      // "Esta semana" das pagelas é a mesma semana letiva.
      expect(pagelasRepository.getPagelasOverallStats).toHaveBeenCalledWith({
        year: 2026,
        week: 28,
      });
    });
  });

  describe('crescimento', () => {
    it('crianças: as duas pontas saem da mesma consulta', async () => {
      overviewRepository.getTotalCounts.mockResolvedValue({
        // Total de hoje diferente de propósito: ele não entra na conta.
        totalChildren: 999,
        totalClubs: 0,
        totalTeachers: 0,
        inactiveChildren: 0,
        inactiveClubs: 0,
      });
      overviewRepository.getChildrenCountAt.mockImplementation((date: string) =>
        Promise.resolve(date === '2026-09-12' ? 120 : 100),
      );

      const overview = await service.getOverviewStatistics();

      expect(overviewRepository.getChildrenCountAt).toHaveBeenCalledWith(
        '2026-09-12',
      );
      expect(overviewRepository.getChildrenCountAt).toHaveBeenCalledWith(
        '2026-06-12',
      );
      expect(overview.indicators?.growthRate.children).toBe(20);
    });

    it('decisões: a janela anterior usa a mesma consulta da atual, sem sobrepor dias', async () => {
      acceptedChristsRepository.getAcceptedChristsOverallStats.mockImplementation(
        (filters: { startDate?: string; endDate?: string }) => {
          if (filters.startDate === '2026-06-12') {
            return Promise.resolve({ totalDecisions: 15, byDecisionType: {} });
          }
          if (filters.startDate === '2026-03-12') {
            return Promise.resolve({ totalDecisions: 10, byDecisionType: {} });
          }
          return Promise.resolve({ totalDecisions: 0, byDecisionType: {} });
        },
      );

      const overview = await service.getOverviewStatistics();

      expect(
        acceptedChristsRepository.getAcceptedChristsOverallStats,
      ).toHaveBeenCalledWith({
        startDate: '2026-03-12',
        endDate: '2026-06-11',
      });
      expect(overview.indicators?.growthRate.decisions).toBe(50);
    });
  });

  it('"ativos no mês" e os indicadores do mês usam a data da pagela, de 1º até hoje', async () => {
    overviewRepository.getActiveCounts.mockResolvedValue({
      activeChildren: 42,
      activeTeachers: 7,
    });
    overviewRepository.countClubsWithLowAttendance.mockResolvedValue(2);

    const overview = await service.getOverviewStatistics();

    expect(overviewRepository.getActiveCounts).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-09-12',
    );
    expect(overviewRepository.countClubsWithLowAttendance).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-09-12',
    );
    expect(overview.summary.activeChildrenThisMonth).toBe(42);
    expect(overview.indicators?.clubsWithLowAttendance).toBe(2);
  });
});

describe('StatisticsService — listagens', () => {
  const childrenRepository = { getChildrenWithStats: jest.fn() };
  const clubsTeachersRepository = {
    getClubsWithStats: jest.fn(),
    getTeachersWithStats: jest.fn(),
  };
  const periodService = { applyPeriodFilter: jest.fn() };
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
    periodService.applyPeriodFilter.mockImplementation(
      (filters: unknown) => filters,
    );
    // 12/09/2026 cai na semana letiva 28 de um período que abre em 02/03.
    academicWeekService.calculateCurrentAcademicWeek.mockResolvedValue({
      academicYear: 2026,
      academicWeek: 28,
      isWithinPeriod: true,
      periodStartDate: '2026-03-02',
      periodEndDate: '2026-12-19',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: PagelasStatisticsRepository, useValue: {} },
        { provide: OverviewStatisticsRepository, useValue: {} },
        { provide: AcceptedChristsStatisticsRepository, useValue: {} },
        { provide: ChildrenStatisticsRepository, useValue: childrenRepository },
        { provide: AttendanceStatisticsRepository, useValue: {} },
        {
          provide: ClubsTeachersStatisticsRepository,
          useValue: clubsTeachersRepository,
        },
        { provide: StatisticsPeriodService, useValue: periodService },
        { provide: AcademicWeekService, useValue: academicWeekService },
      ],
    }).compile();

    service = moduleRef.get(StatisticsService);
  });

  describe('getChildrenStats', () => {
    const child = (id: string) => ({
      id,
      name: `Criança ${id}`,
      gender: 'F',
      birthDate: '2016-01-01',
      joinedAt: '2026-03-01',
      club: null,
      address: null,
    });

    const pagelaStats = (
      childId: string,
      overrides: Record<string, unknown>,
    ) => ({
      childId,
      totalPagelas: '0',
      presenceCount: '0',
      meditationCount: '0',
      verseCount: '0',
      lastActivity: null,
      lastPresence: null,
      weekKeys: undefined,
      ...overrides,
    });

    beforeEach(() => {
      const children = [child('a'), child('b'), child('sem-dados')];
      childrenRepository.getChildrenWithStats.mockResolvedValue({
        children,
        allFilteredChildren: children,
        pagelasStats: new Map([
          [
            'a',
            pagelaStats('a', {
              totalPagelas: '8',
              presenceCount: '8',
              meditationCount: '8',
              verseCount: '8',
              lastActivity: '2026-09-05',
              lastPresence: '2026-09-05',
              weekKeys: '2026-027,2026-026,2026-025',
            }),
          ],
          [
            'b',
            pagelaStats('b', {
              totalPagelas: '4',
              presenceCount: '2',
              // Teve pagela ontem, mas de falta: a última presença é de junho.
              lastActivity: '2026-09-11',
              lastPresence: '2026-06-06',
              weekKeys: '2026-010,2026-009',
            }),
          ],
        ]),
        decisionsMap: new Map(),
        // "a" e "b" eram esperadas em 10 sábados; a terceira ainda não tinha
        // entrado no recorte.
        expectedByChild: new Map([
          ['a', 10],
          ['b', 10],
        ]),
        totalCount: 3,
        filteredCount: 3,
        page: 1,
        limit: 20,
      });
    });

    it('a presença da criança é presentes ÷ esperados, não ÷ pagelas', async () => {
      const result = await service.getChildrenStats({});
      const [a, b, semDados] = result.children;

      // 8 de 10 esperados; na conta antiga, 8 de 8 pagelas davam 100%.
      expect(a.stats.presenceRate).toBe(80);
      // 2 de 10 esperados; antes, 2 de 4 pagelas davam 50%.
      expect(b.stats.presenceRate).toBe(20);
      expect(semDados.stats.presenceRate).toBe(0);
    });

    it('as médias deixam de fora quem não tem dado no recorte', async () => {
      const result = await service.getChildrenStats({});

      // (80 + 20) / 2 — a criança sem nada esperado não entra como 0%.
      expect(result.summary.avgPresenceRate).toBe(50);
      // Engajamento: "a" 100 e "b" 15 (2 × 0,3 ÷ 4); média 57,5.
      expect(result.summary.avgEngagementScore).toBe(57.5);
    });

    it('"ativa" é quem teve presença nos últimos 30 dias, não quem teve pagela', async () => {
      const result = await service.getChildrenStats({});
      const [a, b] = result.children;

      expect(a.isActive).toBe(true);
      expect(b.isActive).toBe(false);
      expect(result.summary.activeChildren).toBe(1);
    });

    it('a sequência de semanas só vale se chegar à semana letiva corrente', async () => {
      const result = await service.getChildrenStats({});
      const [a, b] = result.children;

      // Semana corrente 28: "a" veio na 27, 26 e 25; "b" parou na 10.
      expect(a.stats.consecutiveWeeks).toBe(3);
      expect(b.stats.consecutiveWeeks).toBe(0);
    });

    it('no recorte por professor a presença volta a ser sobre as pagelas', async () => {
      const base = (await childrenRepository.getChildrenWithStats()) as Record<
        string,
        unknown
      >;
      childrenRepository.getChildrenWithStats.mockResolvedValue({
        ...base,
        expectedByChild: null,
      });

      const result = await service.getChildrenStats({ teacherId: 't-1' });

      expect(result.children[1].stats.presenceRate).toBe(50);
    });
  });

  describe('getClubsStats', () => {
    const club = (id: string, number: number) => ({
      id,
      number,
      weekday: 'saturday',
      time: null,
      address: null,
      coordinator: null,
    });

    beforeEach(() => {
      const clubs = [club('c1', 1), club('c2', 2), club('novo', 3)];
      clubsTeachersRepository.getClubsWithStats.mockResolvedValue({
        clubs,
        allFilteredClubs: clubs,
        childrenResults: [],
        allChildrenResults: [
          { clubId: 'c1', gender: 'F', total: '10', avgAge: '9' },
        ],
        pagelasResults: [],
        allPagelasResults: [
          {
            clubId: 'c1',
            totalPagelas: '40',
            activeChildren: '5',
            verseCount: '10',
          },
          { clubId: 'c2', totalPagelas: '20', activeChildren: '4' },
        ],
        decisionsByClub: new Map([
          ['c1', { totalDecisions: 3, childrenWithDecisions: 2 }],
        ]),
        performanceByClub: new Map([
          [
            'c1',
            {
              presenceRate: 80,
              meditationRate: 60,
              activityRate: 50,
              decisionRate: 40,
              performanceScore: 60,
              measured: true,
            },
          ],
          [
            'c2',
            {
              presenceRate: 40,
              meditationRate: 20,
              activityRate: 50,
              decisionRate: 0,
              performanceScore: 28,
              measured: true,
            },
          ],
          [
            'novo',
            {
              presenceRate: 0,
              meditationRate: 0,
              activityRate: 0,
              decisionRate: 0,
              performanceScore: 0,
              measured: false,
            },
          ],
        ]),
        teachers: [],
        allTeachers: [],
        totalCount: 3,
        page: 1,
        limit: 20,
        inactiveClubs: { total: 0, list: [] },
        inactiveChildren: { total: 0, fromInactiveClubs: 0 },
      });
    });

    it('mostra o índice que o repositório calculou — o mesmo que ordenou a lista', async () => {
      const result = await service.getClubsStats({});
      const [c1] = result.clubs;

      expect(c1.performance).toMatchObject({
        presenceRate: 80,
        meditationRate: 60,
        performanceScore: 60,
        totalDecisions: 3,
      });
      expect(c1.children.withDecisions).toBe(2);
      expect(c1.children.active).toBe(5);
      // Campo interno das médias não vaza para a resposta.
      expect(c1).not.toHaveProperty('measured');
    });

    it('as médias não contam o clubinho sem nada a medir como 0%', async () => {
      const result = await service.getClubsStats({});

      // (60 + 28) / 2 e (80 + 40) / 2 — com o clubinho novo seriam 29,3 e 40.
      expect(result.summary.avgPerformanceScore).toBe(44);
      expect(result.summary.avgPresenceRate).toBe(60);
    });
  });

  describe('getTeachersStats', () => {
    it('a média não conta como 0% o professor sem pagela no recorte', async () => {
      const teacher = (id: string) => ({ id, user: { name: id }, club: null });
      const teachers = [teacher('t1'), teacher('t2')];
      clubsTeachersRepository.getTeachersWithStats.mockResolvedValue({
        teachers,
        allFilteredTeachers: teachers,
        pagelasResults: [],
        allPagelasResults: [
          {
            teacherId: 't1',
            totalPagelas: '10',
            uniqueChildren: '5',
            activeChildren: '5',
            presenceCount: '8',
            meditationCount: '0',
            verseCount: '0',
            lastActivity: '2026-09-05',
            lastActivityDay: '2026-09-05',
          },
        ],
        decisionsResults: [],
        allDecisionsResults: [],
        totalCount: 2,
        page: 1,
        limit: 20,
      });

      const result = await service.getTeachersStats({});

      // Só "t1" tem pagela: 80%, e não (80 + 0) / 2.
      expect(result.summary.avgPresenceRate).toBe(80);
      expect(result.summary.activeTeachers).toBe(1);
      expect(result.teachers[1].isActive).toBe(false);
    });
  });
});
