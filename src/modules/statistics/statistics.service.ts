import { Injectable } from '@nestjs/common';
import { StatisticsRepository } from './statistics.repository';
import { StatisticsCalculationsService } from './services/statistics-calculations.service';
import { StatisticsPeriodService } from './services/statistics-period.service';
import { AcademicWeekService } from '../club-control/services/academic-week.service';
import { PagelasStatsQueryDto } from './dto/pagelas-stats-query.dto';
import { AcceptedChristsStatsQueryDto } from './dto/accepted-christs-stats-query.dto';
import { PagelasStatsResponseDto } from './dto/pagelas-stats-response.dto';
import { AcceptedChristsStatsResponseDto } from './dto/accepted-christs-stats-response.dto';
import { OverviewStatsResponseDto } from './dto/overview-stats-response.dto';
import {
  PagelasChartDataDto,
  AcceptedChristsChartDataDto,
  CombinedInsightsDto,
} from './dto/chart-data-response.dto';
import { ChildrenStatsQueryDto } from './dto/children-stats-query.dto';
import { ChildrenStatsResponseDto } from './dto/children-stats-response.dto';
import { ClubsStatsQueryDto } from './dto/clubs-stats-query.dto';
import { ClubsStatsResponseDto } from './dto/clubs-stats-response.dto';
import { TeachersStatsQueryDto } from './dto/teachers-stats-query.dto';
import { TeachersStatsResponseDto } from './dto/teachers-stats-response.dto';

@Injectable()
export class StatisticsService {
  constructor(
    private readonly statisticsRepository: StatisticsRepository,
    private readonly calculationsService: StatisticsCalculationsService,
    private readonly periodService: StatisticsPeriodService,
    private readonly academicWeekService: AcademicWeekService,
  ) {}

  async getPagelasChartData(
    filters: PagelasStatsQueryDto,
  ): Promise<PagelasChartDataDto> {
    const [
      timeSeries,
      byGender,
      byAgeGroup,
      byClub,
      byTeacher,
      byCity,
      byParticipationTime,
    ] = await Promise.all([
      this.statisticsRepository.getPagelasTimeSeries(filters),
      this.statisticsRepository.getPagelasByGender(filters),
      this.statisticsRepository.getPagelasByAgeGroup(filters),
      this.statisticsRepository.getPagelasByClub(filters),
      this.statisticsRepository.getPagelasByTeacher(filters),
      this.statisticsRepository.getPagelasByCity(filters),
      this.statisticsRepository.getPagelasByParticipationTime(filters),
    ]);

    const timeSeriesData = {
      presence: timeSeries.map((t) => ({
        date: t.date,
        value: t.present,
      })),
      meditation: timeSeries.map((t) => ({
        date: t.date,
        value: t.meditation,
      })),
      verseRecitation: timeSeries.map((t) => ({
        date: t.date,
        value: t.verse,
      })),
      total: timeSeries.map((t) => ({
        date: t.date,
        value: t.total,
      })),
    };

    return {
      timeSeries: timeSeriesData,
      byGender,
      byAgeGroup,
      byClub,
      byTeacher,
      byCity,
      byParticipationTime,
    };
  }

  async getAcceptedChristsChartData(
    filters: AcceptedChristsStatsQueryDto,
  ): Promise<AcceptedChristsChartDataDto> {
    const [
      timeSeriesRaw,
      byGender,
      byAgeGroup,
      byClub,
      byCity,
      byParticipationTime,
    ] = await Promise.all([
      this.statisticsRepository.getAcceptedChristsTimeSeries(filters),
      this.statisticsRepository.getAcceptedChristsByGender(filters),
      this.statisticsRepository.getAcceptedChristsByAgeGroup(filters),
      this.statisticsRepository.getAcceptedChristsByClub(filters),
      this.statisticsRepository.getAcceptedChristsByCity(filters),
      this.statisticsRepository.getAcceptedChristsByParticipationTime(filters),
    ]);

    const timeSeries = timeSeriesRaw.map((t) => ({
      date: t.date,
      series: {
        ACCEPTED: t.accepted,
        RECONCILED: t.reconciled,
        total: t.total,
      },
    }));

    return {
      timeSeries,
      byGender,
      byAgeGroup,
      byClub,
      byCity,
      byParticipationTime,
    };
  }

  async getCombinedInsights(
    pagelasFilters: PagelasStatsQueryDto,
    acceptedChristsFilters: AcceptedChristsStatsQueryDto,
  ): Promise<CombinedInsightsDto> {
    const [topEngagedChildren, clubRankings] = await Promise.all([
      this.statisticsRepository.getTopEngagedChildren(pagelasFilters, 20),
      this.statisticsRepository.getClubRankings(pagelasFilters),
    ]);

    return {
      topEngagedChildren,
      clubRankings,
    };
  }

  async getOverviewStatistics(): Promise<OverviewStatsResponseDto> {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Get current week from the academic period, not Gregorian calendar
    const currentAcademicWeek =
      await this.academicWeekService.calculateCurrentAcademicWeek();
    const currentWeek = currentAcademicWeek?.academicWeek || 1;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    const sixWeeksAgo = new Date(now);
    sixWeeksAgo.setDate(now.getDate() - 42); // 6 weeks = 42 days
    const sixWeeksAgoStr = sixWeeksAgo.toISOString().split('T')[0];

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const [
      totalCounts,
      activeCountsThisMonth,
      pagelasThisWeek,
      pagelasThisMonth,
      pagelasLastSixWeeks,
      pagelasLast7Days,
      pagelasLast30Days,
      acceptedChristsThisWeek,
      acceptedChristsThisMonth,
      acceptedChristsThisYear,
      acceptedChristsLastSixMonths,
      acceptedChristsLast3Months,
      topEngagedChildren,
      topPerformingClubs,
      clubsPerformanceMetrics,
      childrenEngagementMetrics,
      genderDistribution,
      geographicDistribution,
    ] = await Promise.all([
      this.statisticsRepository.getTotalCounts(),
      this.statisticsRepository.getActiveCountsThisMonth(),
      this.statisticsRepository.getPagelasOverallStats({
        year: currentYear,
        week: currentWeek,
      }),
      this.statisticsRepository.getPagelasOverallStats({
        startDate: startOfMonthStr,
        endDate: todayStr,
      }),
      this.statisticsRepository.getPagelasWeeklyStats({
        startDate: sixWeeksAgoStr,
        endDate: todayStr,
      }),
      this.statisticsRepository.getPagelasOverallStats({
        startDate: sevenDaysAgoStr,
        endDate: todayStr,
      }),
      this.statisticsRepository.getPagelasOverallStats({
        startDate: startOfMonthStr,
        endDate: todayStr,
      }),
      this.statisticsRepository.getAcceptedChristsOverallStats({
        startDate: startOfWeekStr,
        endDate: todayStr,
      }),
      this.statisticsRepository.getAcceptedChristsOverallStats({
        startDate: startOfMonthStr,
        endDate: todayStr,
      }),
      this.statisticsRepository.getAcceptedChristsOverallStats({
        startDate: `${currentYear}-01-01`,
        endDate: todayStr,
      }),
      this.statisticsRepository.getAcceptedChristsByPeriod({
        startDate: sixMonthsAgoStr,
        endDate: todayStr,
        groupBy: 'month',
      }),
      this.statisticsRepository.getAcceptedChristsOverallStats({
        startDate: threeMonthsAgoStr,
        endDate: todayStr,
      }),
      this.statisticsRepository.getTopEngagedChildren(
        { startDate: startOfMonthStr, endDate: todayStr },
        5,
      ),
      this.statisticsRepository.getClubRankings({
        startDate: startOfMonthStr,
        endDate: todayStr,
      }),
      this.statisticsRepository.getClubsPerformanceMetrics(),
      this.statisticsRepository.getChildrenEngagementMetrics(),
      this.statisticsRepository.getChildrenGenderDistribution(),
      this.statisticsRepository.getGeographicDistribution(),
    ]);

    // Calcular taxa de crescimento
    const threeMonthsAgoChildCount =
      await this.statisticsRepository.getChildrenCountAt(threeMonthsAgoStr);
    const childrenGrowthRate =
      threeMonthsAgoChildCount > 0
        ? ((totalCounts.totalChildren - threeMonthsAgoChildCount) /
            threeMonthsAgoChildCount) *
          100
        : 0;

    const threeMonthsAgoAcceptedChrists =
      await this.statisticsRepository.getAcceptedChristsCountBefore(
        threeMonthsAgoStr,
      );
    const decisionsGrowthRate =
      threeMonthsAgoAcceptedChrists > 0
        ? ((acceptedChristsLast3Months.totalDecisions -
            threeMonthsAgoAcceptedChrists) /
            threeMonthsAgoAcceptedChrists) *
          100
        : 0;

    return {
      summary: {
        totalChildren: totalCounts.totalChildren,
        totalClubs: totalCounts.totalClubs,
        totalTeachers: totalCounts.totalTeachers,
        activeChildrenThisMonth: activeCountsThisMonth.activeChildren,
        activeTeachersThisMonth: activeCountsThisMonth.activeTeachers,
        inactiveChildren: totalCounts.inactiveChildren,
        inactiveClubs: totalCounts.inactiveClubs,
      },
      pagelas: {
        thisWeek: {
          total: pagelasThisWeek.totalPagelas,
          presenceRate: pagelasThisWeek.averagePresenceRate,
          meditationRate: pagelasThisWeek.averageMeditationRate,
          verseRecitationRate: pagelasThisWeek.averageVerseRecitationRate,
        },
        thisMonth: {
          total: pagelasThisMonth.totalPagelas,
          presenceRate: pagelasThisMonth.averagePresenceRate,
          meditationRate: pagelasThisMonth.averageMeditationRate,
          verseRecitationRate: pagelasThisMonth.averageVerseRecitationRate,
        },
        lastSixWeeks: pagelasLastSixWeeks.slice(0, 6).map((week) => ({
          week: week.week,
          year: week.year,
          total: week.totalPagelas,
          presenceRate: week.presenceRate,
        })),
      },
      acceptedChrists: {
        thisWeek: acceptedChristsThisWeek.totalDecisions,
        thisMonth: acceptedChristsThisMonth.totalDecisions,
        thisYear: acceptedChristsThisYear.totalDecisions,
        byDecisionType: acceptedChristsThisYear.byDecisionType,
        lastSixMonths: acceptedChristsLastSixMonths
          .slice(0, 6)
          .map((period) => ({
            month: period.period,
            total: period.totalDecisions,
          })),
      },
      // ⭐ NOVO: Métricas de engajamento
      engagement: {
        avgEngagementScore: childrenEngagementMetrics.avgEngagementScore,
        topPerformingClubs: topPerformingClubs.slice(0, 5).map((club) => ({
          clubId: club.clubId,
          clubNumber: club.clubNumber,
          performanceScore: club.performanceScore,
          city: club.city || 'N/A',
        })),
        topEngagedChildren: topEngagedChildren.slice(0, 5).map((child) => ({
          childId: child.childId,
          name: child.childName,
          engagementScore: child.engagementScore,
          clubNumber: child.clubNumber || 0,
        })),
        recentActivity: {
          last7Days: pagelasLast7Days.totalPagelas,
          last30Days: pagelasLast30Days.totalPagelas,
        },
      },
      // ⭐ NOVO: Indicadores e alertas
      indicators: {
        clubsWithLowAttendance: clubsPerformanceMetrics.clubsWithLowAttendance,
        childrenWithLowEngagement:
          childrenEngagementMetrics.childrenWithLowEngagement,
        clubsMissingPagelas: clubsPerformanceMetrics.clubsMissingPagelas,
        growthRate: {
          children: Math.round(childrenGrowthRate * 10) / 10,
          decisions: Math.round(decisionsGrowthRate * 10) / 10,
        },
      },
      // ⭐ NOVO: Estatísticas rápidas
      quickStats: {
        childrenByGender: genderDistribution,
        clubsByState: geographicDistribution.byState.slice(0, 10),
        topCities: geographicDistribution.topCities.slice(0, 10),
      },
    };
  }

  async getPagelasStatistics(
    filters: PagelasStatsQueryDto,
  ): Promise<PagelasStatsResponseDto> {
    const [overall, byWeek, topPerformers] = await Promise.all([
      this.statisticsRepository.getPagelasOverallStats(filters),
      this.statisticsRepository.getPagelasWeeklyStats(filters),
      this.statisticsRepository.getPagelasTopPerformers(filters, 10),
    ]);

    return {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        year: filters.year,
        week: filters.week,
      },
      overall,
      byWeek,
      topPerformers,
    };
  }

  async getAcceptedChristsStatistics(
    filters: AcceptedChristsStatsQueryDto,
  ): Promise<AcceptedChristsStatsResponseDto> {
    const [overall, byPeriod, recentDecisions] = await Promise.all([
      this.statisticsRepository.getAcceptedChristsOverallStats(filters),
      this.statisticsRepository.getAcceptedChristsByPeriod(filters),
      this.statisticsRepository.getRecentAcceptedChrists(filters, 10),
    ]);

    return {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      overall,
      byPeriod,
      recentDecisions,
    };
  }

  async getClubDetailedStats(clubId: string, filters: PagelasStatsQueryDto) {
    return {
      message: 'Visão detalhada do clube - Em implementação',
      clubId,
      filters,
    };
  }

  async getChildDetailedStats(childId: string) {
    return {
      message: 'Visão detalhada da criança - Em implementação',
      childId,
    };
  }

  async getCityDetailedStats(city: string, filters: any) {
    return {
      message: 'Visão detalhada da cidade - Em implementação',
      city,
      filters,
    };
  }

  async getTeacherDetailedStats(
    teacherId: string,
    filters: PagelasStatsQueryDto,
  ) {
    return {
      message: 'Visão detalhada do professor - Em implementação',
      teacherId,
      filters,
    };
  }

  async getComparativeStats(params: any) {
    return {
      message: 'Comparação entre entidades - Em implementação',
      params,
    };
  }

  async getTrendsAnalysis(filters: any) {
    return {
      message: 'Análise de tendências e previsões - Em implementação',
      filters,
    };
  }

  async getConsolidatedReport(params: any) {
    return {
      message: 'Relatório consolidado - Em implementação',
      params,
    };
  }

  async getRankings(type: string, params: any) {
    return {
      message: 'Rankings - Em implementação',
      type,
      params,
    };
  }

  async getPersonalizedDashboard(role: string, userId: string) {
    return {
      message: 'Dashboard personalizado - Em implementação',
      role,
      userId,
    };
  }

  async getChildrenStats(
    filters: ChildrenStatsQueryDto,
  ): Promise<ChildrenStatsResponseDto> {
    // ⭐ Aplicar filtro de período se especificado
    const processedFilters = this.periodService.applyPeriodFilter(filters);

    const [childrenData, distribution] = await Promise.all([
      this.statisticsRepository.getChildrenWithStats(processedFilters),
      this.statisticsRepository.getChildrenStatsDistribution(processedFilters),
    ]);

    const {
      children,
      pagelasStats,
      decisionsMap,
      totalCount,
      filteredCount,
      page,
      limit,
    } = childrenData;

    let sumAge = 0;
    let sumEngagement = 0;
    let sumPresenceRate = 0;
    let childrenWithDecisions = 0;
    let activeChildren = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const childrenWithStats = children.map((child, index) => {
      const age = this.calculationsService.calculateAge(child.birthDate);
      const monthsParticipating =
        this.calculationsService.calculateMonthsParticipating(child.joinedAt);
      const participationTimeRange =
        this.calculationsService.getParticipationTimeRange(monthsParticipating);

      const stats = pagelasStats.get(child.id);
      const totalPagelas = stats ? parseInt(stats.totalPagelas) : 0;
      const presenceCount = stats ? parseInt(stats.presenceCount) : 0;
      const meditationCount = stats ? parseInt(stats.meditationCount) : 0;
      const verseCount = stats ? parseInt(stats.verseCount) : 0;

      const presenceRate =
        totalPagelas > 0 ? (presenceCount / totalPagelas) * 100 : 0;
      const meditationRate =
        totalPagelas > 0 ? (meditationCount / totalPagelas) * 100 : 0;
      const verseRecitationRate =
        totalPagelas > 0 ? (verseCount / totalPagelas) * 100 : 0;

      const engagementScore =
        totalPagelas > 0
          ? ((presenceCount * 0.3 +
              meditationCount * 0.35 +
              verseCount * 0.35) /
              totalPagelas) *
            100
          : 0;

      const decision = decisionsMap.get(child.id);
      const hasDecision = !!decision;
      const totalDecisions = decision ? parseInt(decision.totalDecisions) : 0;

      const lastPagelaDate = stats?.lastPagelaDate || null;
      const isActive = lastPagelaDate
        ? lastPagelaDate >= thirtyDaysAgoStr
        : false;

      const consecutiveWeeks = 0;

      sumAge += age;
      sumEngagement += engagementScore;
      sumPresenceRate += presenceRate;
      if (hasDecision) childrenWithDecisions++;
      if (isActive) activeChildren++;

      return {
        childId: child.id,
        name: child.name,
        gender: child.gender,
        age,
        birthDate: child.birthDate,
        joinedAt: child.joinedAt || null,
        monthsParticipating,
        participationTimeRange,
        club: child.club
          ? {
              id: child.club.id,
              number: child.club.number,
              weekday: child.club.weekday,
            }
          : null,
        address: child.address
          ? {
              city: child.address.city,
              state: child.address.state,
              district: child.address.district,
            }
          : null,
        stats: {
          totalPagelas,
          presenceCount,
          meditationCount,
          verseRecitationCount: verseCount,
          presenceRate: Math.round(presenceRate * 10) / 10,
          meditationRate: Math.round(meditationRate * 10) / 10,
          verseRecitationRate: Math.round(verseRecitationRate * 10) / 10,
          engagementScore: Math.round(engagementScore * 10) / 10,
          lastPagelaDate,
          consecutiveWeeks,
        },
        decisions: {
          hasDecision,
          decisionType: decision?.lastDecision || null,
          decisionDate: decision?.lastDecisionDate || null,
          totalDecisions,
        },
        isActive,
        rank: index + 1 + (page - 1) * limit,
      };
    });

    const totalPages = Math.ceil(filteredCount / limit);

    return {
      filters: {
        applied: processedFilters,
        summary: this.buildFiltersSummary(processedFilters),
      },
      summary: {
        totalChildren: totalCount,
        filteredChildren: filteredCount,
        avgAge: filteredCount > 0 ? Math.round(sumAge / filteredCount) : 0,
        avgEngagementScore:
          filteredCount > 0
            ? Math.round((sumEngagement / filteredCount) * 10) / 10
            : 0,
        avgPresenceRate:
          filteredCount > 0
            ? Math.round((sumPresenceRate / filteredCount) * 10) / 10
            : 0,
        childrenWithDecisions,
        activeChildren,
      },
      distribution,
      children: childrenWithStats,
      pagination: {
        page,
        limit,
        total: filteredCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private buildFiltersSummary(filters: ChildrenStatsQueryDto): string {
    const parts: string[] = [];

    if (filters.gender) parts.push(`Gênero: ${filters.gender}`);
    if (filters.minAge || filters.maxAge) {
      parts.push(`Idade: ${filters.minAge || 0}-${filters.maxAge || '+'}`);
    }
    if (filters.city) parts.push(`Cidade: ${filters.city}`);
    if (filters.clubId) parts.push(`Clubinho específico`);
    if (filters.hasDecision) parts.push(`Com decisão`);
    if (filters.isActive) parts.push(`Ativos`);

    return parts.length > 0 ? parts.join(' | ') : 'Sem filtros';
  }

  async getClubsStats(
    filters: ClubsStatsQueryDto,
  ): Promise<ClubsStatsResponseDto> {
    // ⭐ Aplicar filtro de período se especificado
    const processedFilters = this.periodService.applyPeriodFilter(filters);

    const clubsData =
      await this.statisticsRepository.getClubsWithStats(processedFilters);
    const {
      clubs,
      childrenResults,
      pagelasResults,
      decisionsResults,
      teachers,
      totalCount,
      page,
      limit,
      inactiveClubs,
      inactiveChildren,
    } = clubsData;

    const childrenByClub = new Map();
    childrenResults.forEach((r) => {
      if (!childrenByClub.has(r.clubId)) {
        childrenByClub.set(r.clubId, { total: 0, M: 0, F: 0 });
      }
      const data = childrenByClub.get(r.clubId);
      const count = parseInt(r.total);
      data.total += count;
      if (r.gender === 'M') data.M = count;
      if (r.gender === 'F') data.F = count;
    });

    const pagelasByClub = new Map(pagelasResults.map((p) => [p.clubId, p]));
    const decisionsByClub = new Map(decisionsResults.map((d) => [d.clubId, d]));
    const teachersByClub = new Map();

    teachers.forEach((t) => {
      if (t.club) {
        if (!teachersByClub.has(t.club.id)) {
          teachersByClub.set(t.club.id, []);
        }
        teachersByClub.get(t.club.id).push(t);
      }
    });

    const clubsWithStats = clubs.map((club, index) => {
      const children = childrenByClub.get(club.id) || { total: 0, M: 0, F: 0 };
      const pagelas = pagelasByClub.get(club.id);
      const decisions = decisionsByClub.get(club.id);
      const clubTeachers = teachersByClub.get(club.id) || [];

      const totalPagelas = pagelas ? parseInt(pagelas.totalPagelas) : 0;
      const presenceCount = pagelas ? parseInt(pagelas.presenceCount) : 0;
      const meditationCount = pagelas ? parseInt(pagelas.meditationCount) : 0;
      const verseCount = pagelas ? parseInt(pagelas.verseCount) : 0;

      const presenceRate =
        totalPagelas > 0 ? (presenceCount / totalPagelas) * 100 : 0;
      const meditationRate =
        totalPagelas > 0 ? (meditationCount / totalPagelas) * 100 : 0;
      const verseRate =
        totalPagelas > 0 ? (verseCount / totalPagelas) * 100 : 0;

      const activeChildren = pagelas ? parseInt(pagelas.activeChildren) : 0;
      const activityRate =
        children.total > 0 ? (activeChildren / children.total) * 100 : 0;
      const decisionRate =
        activeChildren > 0
          ? ((decisions ? parseInt(decisions.childrenWithDecisions) : 0) /
              activeChildren) *
            100
          : 0;

      const performanceScore =
        presenceRate * 0.3 +
        meditationRate * 0.3 +
        activityRate * 0.2 +
        decisionRate * 0.2;

      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        time: club.time || null,
        address: {
          city: club.address.city,
          state: club.address.state,
          district: club.address.district,
          street: club.address.street,
        },
        coordinator: club.coordinator
          ? {
              id: club.coordinator.id,
              name: club.coordinator.user?.name || 'N/A',
            }
          : null,
        children: {
          total: children.total,
          active: activeChildren,
          byGender: {
            M: children.M,
            F: children.F,
          },
          avgAge: 0, // TODO: Calculate
          withDecisions: decisions
            ? parseInt(decisions.childrenWithDecisions)
            : 0,
        },
        teachers: {
          total: clubTeachers.length,
          active: pagelas ? parseInt(pagelas.activeTeachers) : 0,
          list: clubTeachers.map((t) => ({
            id: t.id,
            name: t.user?.name || 'N/A',
          })),
        },
        performance: {
          totalPagelas,
          presenceRate: Math.round(presenceRate * 10) / 10,
          meditationRate: Math.round(meditationRate * 10) / 10,
          verseRecitationRate: Math.round(verseRate * 10) / 10,
          performanceScore: Math.round(performanceScore * 10) / 10,
          totalDecisions: decisions ? parseInt(decisions.totalDecisions) : 0,
        },
        lastActivity: pagelas?.lastActivity
          ? {
              date: pagelas.lastActivity,
              type: 'pagela',
            }
          : null,
        rank: index + 1 + (page - 1) * limit,
      };
    });

    const byCity = new Map();
    const byWeekday = new Map();
    const byCoordinator = new Map();
    const byPerformance = new Map([
      ['0-50', 0],
      ['50-70', 0],
      ['70-85', 0],
      ['85-100', 0],
    ]);

    clubsWithStats.forEach((club) => {
      // City
      const cityKey = club.address.city;
      if (!byCity.has(cityKey)) {
        byCity.set(cityKey, { state: club.address.state, count: 0 });
      }
      byCity.get(cityKey).count++;

      // Weekday
      byWeekday.set(club.weekday, (byWeekday.get(club.weekday) || 0) + 1);

      // Coordinator
      if (club.coordinator) {
        const coordKey = club.coordinator.id;
        if (!byCoordinator.has(coordKey)) {
          byCoordinator.set(coordKey, {
            name: club.coordinator.name,
            count: 0,
          });
        }
        byCoordinator.get(coordKey).count++;
      }

      // Performance range
      const score = club.performance.performanceScore;
      if (score < 50)
        byPerformance.set('0-50', (byPerformance.get('0-50') || 0) + 1);
      else if (score < 70)
        byPerformance.set('50-70', (byPerformance.get('50-70') || 0) + 1);
      else if (score < 85)
        byPerformance.set('70-85', (byPerformance.get('70-85') || 0) + 1);
      else byPerformance.set('85-100', (byPerformance.get('85-100') || 0) + 1);
    });

    const totalFiltered = clubsWithStats.length;
    const totalPages = Math.ceil(totalCount / limit);

    const summary = {
      totalClubs: totalCount,
      filteredClubs: totalFiltered,
      totalChildren: clubsWithStats.reduce(
        (sum, c) => sum + c.children.total,
        0,
      ),
      totalTeachers: clubsWithStats.reduce(
        (sum, c) => sum + c.teachers.total,
        0,
      ),
      avgPerformanceScore:
        totalFiltered > 0
          ? Math.round(
              (clubsWithStats.reduce(
                (sum, c) => sum + c.performance.performanceScore,
                0,
              ) /
                totalFiltered) *
                10,
            ) / 10
          : 0,
      avgPresenceRate:
        totalFiltered > 0
          ? Math.round(
              (clubsWithStats.reduce(
                (sum, c) => sum + c.performance.presenceRate,
                0,
              ) /
                totalFiltered) *
                10,
            ) / 10
          : 0,
      totalDecisions: clubsWithStats.reduce(
        (sum, c) => sum + c.performance.totalDecisions,
        0,
      ),
    };

    return {
      filters: {
        applied: processedFilters,
        summary: this.buildClubsFiltersSummary(processedFilters),
      },
      summary,
      distribution: {
        byCity: Array.from(byCity.entries()).map(([city, data]) => ({
          city,
          state: data.state,
          count: data.count,
          percentage:
            totalFiltered > 0 ? (data.count / totalFiltered) * 100 : 0,
        })),
        byWeekday: Array.from(byWeekday.entries()).map(([weekday, count]) => ({
          weekday,
          count,
          percentage: totalFiltered > 0 ? (count / totalFiltered) * 100 : 0,
        })),
        byCoordinator: Array.from(byCoordinator.entries()).map(
          ([id, data]) => ({
            coordinatorId: id,
            coordinatorName: data.name,
            count: data.count,
            percentage:
              totalFiltered > 0 ? (data.count / totalFiltered) * 100 : 0,
          }),
        ),
        byPerformance: Array.from(byPerformance.entries()).map(
          ([range, count]) => ({
            range,
            count,
            percentage: totalFiltered > 0 ? (count / totalFiltered) * 100 : 0,
          }),
        ),
      },
      clubs: clubsWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
      inactiveClubs: inactiveClubs || { total: 0, list: [] },
      inactiveChildren: inactiveChildren || { total: 0, fromInactiveClubs: 0 },
    };
  }

  async getTeachersStats(
    filters: TeachersStatsQueryDto,
  ): Promise<TeachersStatsResponseDto> {
    // ⭐ Aplicar filtro de período se especificado
    const processedFilters = this.periodService.applyPeriodFilter(filters);

    const teachersData =
      await this.statisticsRepository.getTeachersWithStats(processedFilters);
    const {
      teachers,
      pagelasResults,
      decisionsResults,
      totalCount,
      page,
      limit,
    } = teachersData;

    const pagelasByTeacher = new Map(
      pagelasResults.map((p) => [p.teacherId, p]),
    );
    const decisionsByTeacher = new Map(
      decisionsResults.map((d) => [d.teacherId, d]),
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const teachersWithStats = teachers.map((teacher, index) => {
      const pagelas = pagelasByTeacher.get(teacher.id);
      const decisions = decisionsByTeacher.get(teacher.id);

      const totalPagelas = pagelas ? parseInt(pagelas.totalPagelas) : 0;
      const uniqueChildren = pagelas ? parseInt(pagelas.uniqueChildren) : 0;
      const presenceCount = pagelas ? parseInt(pagelas.presenceCount) : 0;
      const meditationCount = pagelas ? parseInt(pagelas.meditationCount) : 0;
      const verseCount = pagelas ? parseInt(pagelas.verseCount) : 0;

      const avgPresenceRate =
        totalPagelas > 0 ? (presenceCount / totalPagelas) * 100 : 0;
      const avgMeditationRate =
        totalPagelas > 0 ? (meditationCount / totalPagelas) * 100 : 0;
      const avgVerseRate =
        totalPagelas > 0 ? (verseCount / totalPagelas) * 100 : 0;

      const childrenWithDecisions = decisions
        ? parseInt(decisions.childrenWithDecisions)
        : 0;
      const decisionRate =
        uniqueChildren > 0 ? (childrenWithDecisions / uniqueChildren) * 100 : 0;

      const effectivenessScore =
        avgPresenceRate * 0.4 + avgMeditationRate * 0.3 + decisionRate * 0.3;

      const lastActivity = pagelas?.lastActivity;
      const isActive = lastActivity ? lastActivity >= thirtyDaysAgoStr : false;

      return {
        teacherId: teacher.id,
        name: teacher.user?.name || 'N/A',
        club: teacher.club
          ? {
              id: teacher.club.id,
              number: teacher.club.number,
              weekday: teacher.club.weekday,
              city: teacher.club.address?.city || 'N/A',
              state: teacher.club.address?.state || 'N/A',
            }
          : null,
        coordinator: teacher.club?.coordinator
          ? {
              id: teacher.club.coordinator.id,
              name: teacher.club.coordinator.user?.name || 'N/A',
            }
          : null,
        children: {
          total: uniqueChildren,
          unique: uniqueChildren,
          active: 0, // TODO: Calculate active children
          withDecisions: childrenWithDecisions,
          avgEngagement: 0, // TODO: Calculate
        },
        performance: {
          totalPagelas,
          avgPresenceRate: Math.round(avgPresenceRate * 10) / 10,
          avgMeditationRate: Math.round(avgMeditationRate * 10) / 10,
          avgVerseRate: Math.round(avgVerseRate * 10) / 10,
          effectivenessScore: Math.round(effectivenessScore * 10) / 10,
        },
        lastActivity: lastActivity
          ? {
              date: lastActivity,
              totalPagelas,
            }
          : null,
        isActive,
        rank: index + 1 + (page - 1) * limit,
      };
    });

    const byClub = new Map();
    const byCity = new Map();
    const byEffectiveness = new Map([
      ['0-50', 0],
      ['50-70', 0],
      ['70-85', 0],
      ['85-100', 0],
    ]);

    teachersWithStats.forEach((teacher) => {
      // Club
      if (teacher.club) {
        const clubKey = teacher.club.id;
        if (!byClub.has(clubKey)) {
          byClub.set(clubKey, { number: teacher.club.number, count: 0 });
        }
        byClub.get(clubKey).count++;

        // City
        const cityKey = teacher.club.city;
        if (!byCity.has(cityKey)) {
          byCity.set(cityKey, { state: teacher.club.state, count: 0 });
        }
        byCity.get(cityKey).count++;
      }

      // Effectiveness range
      const score = teacher.performance.effectivenessScore;
      if (score < 50)
        byEffectiveness.set('0-50', (byEffectiveness.get('0-50') || 0) + 1);
      else if (score < 70)
        byEffectiveness.set('50-70', (byEffectiveness.get('50-70') || 0) + 1);
      else if (score < 85)
        byEffectiveness.set('70-85', (byEffectiveness.get('70-85') || 0) + 1);
      else
        byEffectiveness.set('85-100', (byEffectiveness.get('85-100') || 0) + 1);
    });

    const totalFiltered = teachersWithStats.length;
    const totalPages = Math.ceil(totalCount / limit);

    const summary = {
      totalTeachers: totalCount,
      filteredTeachers: totalFiltered,
      activeTeachers: teachersWithStats.filter((t) => t.isActive).length,
      totalChildren: teachersWithStats.reduce(
        (sum, t) => sum + t.children.total,
        0,
      ),
      avgEffectivenessScore:
        totalFiltered > 0
          ? Math.round(
              (teachersWithStats.reduce(
                (sum, t) => sum + t.performance.effectivenessScore,
                0,
              ) /
                totalFiltered) *
                10,
            ) / 10
          : 0,
      avgPresenceRate:
        totalFiltered > 0
          ? Math.round(
              (teachersWithStats.reduce(
                (sum, t) => sum + t.performance.avgPresenceRate,
                0,
              ) /
                totalFiltered) *
                10,
            ) / 10
          : 0,
    };

    return {
      filters: {
        applied: processedFilters,
        summary: this.buildTeachersFiltersSummary(processedFilters),
      },
      summary,
      distribution: {
        byClub: Array.from(byClub.entries()).map(([clubId, data]) => ({
          clubId,
          clubNumber: data.number,
          count: data.count,
          percentage:
            totalFiltered > 0 ? (data.count / totalFiltered) * 100 : 0,
        })),
        byCity: Array.from(byCity.entries()).map(([city, data]) => ({
          city,
          state: data.state,
          count: data.count,
          percentage:
            totalFiltered > 0 ? (data.count / totalFiltered) * 100 : 0,
        })),
        byEffectiveness: Array.from(byEffectiveness.entries()).map(
          ([range, count]) => ({
            range,
            count,
            percentage: totalFiltered > 0 ? (count / totalFiltered) * 100 : 0,
          }),
        ),
      },
      teachers: teachersWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private buildClubsFiltersSummary(filters: ClubsStatsQueryDto): string {
    const parts: string[] = [];
    if (filters.coordinatorId) parts.push(`Coordenador específico`);
    if (filters.weekday) parts.push(`Dia: ${filters.weekday}`);
    if (filters.city) parts.push(`Cidade: ${filters.city}`);
    if (filters.minChildren) parts.push(`Min ${filters.minChildren} crianças`);
    return parts.length > 0 ? parts.join(' | ') : 'Sem filtros';
  }

  private buildTeachersFiltersSummary(filters: TeachersStatsQueryDto): string {
    const parts: string[] = [];
    if (filters.clubId) parts.push(`Clubinho específico`);
    if (filters.coordinatorId) parts.push(`Coordenador específico`);
    if (filters.city) parts.push(`Cidade: ${filters.city}`);
    if (filters.isActive) parts.push(`Ativos`);
    return parts.length > 0 ? parts.join(' | ') : 'Sem filtros';
  }

  async analyzeClubAttendance(
    clubId: string,
    year: number,
    startDate?: string,
    endDate?: string,
    page?: number,
    limit?: number,
  ) {
    return this.statisticsRepository.analyzeClubAttendance(
      clubId,
      year,
      startDate,
      endDate,
      page,
      limit,
    );
  }

  async analyzeWeeklyAttendance(
    year: number,
    week: number,
    page?: number,
    limit?: number,
  ) {
    return this.statisticsRepository.analyzeWeeklyAttendance(
      year,
      week,
      page,
      limit,
    );
  }
}
