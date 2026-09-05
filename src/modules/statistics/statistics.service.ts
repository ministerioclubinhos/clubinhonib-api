import { Injectable } from '@nestjs/common';
import { AttendanceStatisticsRepository } from './repositories/attendance-statistics.repository';
import { ChildrenStatisticsRepository } from './repositories/children-statistics.repository';
import { ClubsTeachersStatisticsRepository } from './repositories/clubs-teachers-statistics.repository';
import { PagelasStatisticsRepository } from './repositories/pagelas-statistics.repository';
import { OverviewStatisticsRepository } from './repositories/overview-statistics.repository';
import { AcceptedChristsStatisticsRepository } from './repositories/accepted-christs-statistics.repository';
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

import {
  TeacherDecisionStatsRaw,
  TeacherStatsRaw,
  AcceptedChristsByClubRaw,
  PagelasByClubRaw,
} from './dto/statistics-raw-results.dto';
import { ChildrenStatsQueryDto } from './dto/children-stats-query.dto';
import { ChildrenStatsResponseDto } from './dto/children-stats-response.dto';
import { ClubsStatsQueryDto } from './dto/clubs-stats-query.dto';
import { ClubsStatsResponseDto } from './dto/clubs-stats-response.dto';
import { TeachersStatsQueryDto } from './dto/teachers-stats-query.dto';
import { TeachersStatsResponseDto } from './dto/teachers-stats-response.dto';
import { TeacherProfileEntity } from '../teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import {
  ageGroup as toAgeGroup,
  ageInYears,
  monthsParticipating as countMonthsParticipating,
  participationTimeRange as toParticipationTimeRange,
  average,
  averageOf,
  clubPerformanceScore as calcClubPerformanceScore,
  consecutiveAcademicWeeks,
  engagementScore as calcEngagementScore,
  growthRate,
  percentage,
  roundToOneDecimal,
  toCount,
} from './utils/metrics.utils';
import { toDateOnly } from './utils/date.utils';
import {
  ClubAttendanceAnalysisDto,
  WeeklyAttendanceDto,
} from './dto/club-attendance-analysis.dto';

@Injectable()
export class StatisticsService {
  constructor(
    private readonly attendanceRepository: AttendanceStatisticsRepository,
    private readonly childrenRepository: ChildrenStatisticsRepository,
    private readonly clubsTeachersRepository: ClubsTeachersStatisticsRepository,
    private readonly pagelasRepository: PagelasStatisticsRepository,
    private readonly overviewRepository: OverviewStatisticsRepository,
    private readonly acceptedChristsRepository: AcceptedChristsStatisticsRepository,
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
      this.pagelasRepository.getPagelasTimeSeries(filters),
      this.pagelasRepository.getPagelasByGender(filters),
      this.pagelasRepository.getPagelasByAgeGroup(filters),
      this.pagelasRepository.getPagelasByClub(filters),
      this.pagelasRepository.getPagelasByTeacher(filters),
      this.pagelasRepository.getPagelasByCity(filters),
      this.pagelasRepository.getPagelasByParticipationTime(filters),
    ]);

    const timeSeriesData = {
      presence: timeSeries.map((t) => ({
        date: String(t.date),
        value: t.present,
      })),
      meditation: timeSeries.map((t) => ({
        date: String(t.date),
        value: t.meditation,
      })),
      verseRecitation: timeSeries.map((t) => ({
        date: String(t.date),
        value: t.verse,
      })),
      total: timeSeries.map((t) => ({
        date: String(t.date),
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
      this.acceptedChristsRepository.getAcceptedChristsTimeSeries(filters),
      this.acceptedChristsRepository.getAcceptedChristsByGender(filters),
      this.acceptedChristsRepository.getAcceptedChristsByAgeGroup(filters),
      this.acceptedChristsRepository.getAcceptedChristsByClub(filters),
      this.acceptedChristsRepository.getAcceptedChristsByCity(filters),
      this.acceptedChristsRepository.getAcceptedChristsByParticipationTime(
        filters,
      ),
    ]);

    const timeSeries = timeSeriesRaw.map((t) => ({
      date: String(t.date),
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
  ): Promise<CombinedInsightsDto> {
    const [topEngagedChildren, clubRankings] = await Promise.all([
      this.childrenRepository.getTopEngagedChildren(pagelasFilters, 20),
      this.childrenRepository.getClubRankings(pagelasFilters),
    ]);

    return {
      topEngagedChildren,
      clubRankings,
    };
  }

  async getOverviewStatistics(): Promise<OverviewStatsResponseDto> {
    const now = new Date();
    const currentYear = now.getFullYear();

    const currentAcademicWeek =
      await this.academicWeekService.calculateCurrentAcademicWeek();
    const currentWeekFilters: PagelasStatsQueryDto =
      currentAcademicWeek?.isWithinPeriod &&
      currentAcademicWeek.academicYear &&
      currentAcademicWeek.academicWeek
        ? {
            year: currentAcademicWeek.academicYear,
            week: currentAcademicWeek.academicWeek,
          }
        : { startDate: '1970-01-01', endDate: '1970-01-01' };

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = toDateOnly(startOfMonth);
    const todayStr = toDateOnly(now);

    const startOfWeek = new Date(now);
    const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
    startOfWeek.setDate(now.getDate() - daysSinceMonday);
    const startOfWeekStr = toDateOnly(startOfWeek);

    const sixWeeksAgo = new Date(now);
    sixWeeksAgo.setDate(now.getDate() - 41);
    const sixWeeksAgoStr = toDateOnly(sixWeeksAgo);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 5, 1);
    const sixMonthsAgoStr = toDateOnly(sixMonthsAgo);

    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    const threeMonthsAgoStr = toDateOnly(threeMonthsAgo);

    const sixMonthsGrowthStart = new Date(now);
    sixMonthsGrowthStart.setMonth(now.getMonth() - 6);
    const sixMonthsGrowthStartStr = toDateOnly(sixMonthsGrowthStart);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const sevenDaysAgoStr = toDateOnly(sevenDaysAgo);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    const thirtyDaysAgoStr = toDateOnly(thirtyDaysAgo);

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
      this.overviewRepository.getTotalCounts(),
      this.overviewRepository.getActiveCountsThisMonth(),
      this.pagelasRepository.getPagelasOverallStats(currentWeekFilters),
      this.pagelasRepository.getPagelasOverallStats({
        startDate: thirtyDaysAgoStr,
        endDate: todayStr,
      }),
      this.pagelasRepository.getPagelasWeeklyStats({
        startDate: sixWeeksAgoStr,
        endDate: todayStr,
      }),
      this.pagelasRepository.getPagelasOverallStats({
        startDate: sevenDaysAgoStr,
        endDate: todayStr,
      }),
      this.pagelasRepository.getPagelasOverallStats({
        startDate: startOfMonthStr,
        endDate: todayStr,
      }),
      this.acceptedChristsRepository.getAcceptedChristsOverallStats({
        startDate: startOfWeekStr,
        endDate: todayStr,
      }),
      this.acceptedChristsRepository.getAcceptedChristsOverallStats({
        startDate: startOfMonthStr,
        endDate: todayStr,
      }),
      this.acceptedChristsRepository.getAcceptedChristsOverallStats({
        startDate: `${currentYear}-01-01`,
        endDate: todayStr,
      }),
      this.acceptedChristsRepository.getAcceptedChristsByPeriod({
        startDate: sixMonthsAgoStr,
        endDate: todayStr,
        groupBy: 'month',
      }),
      this.acceptedChristsRepository.getAcceptedChristsOverallStats({
        startDate: threeMonthsAgoStr,
        endDate: todayStr,
      }),
      this.childrenRepository.getTopEngagedChildren(
        { startDate: startOfMonthStr, endDate: todayStr },
        5,
      ),
      this.childrenRepository.getClubRankings({
        startDate: startOfMonthStr,
        endDate: todayStr,
      }),
      this.overviewRepository.getClubsPerformanceMetrics(),
      this.overviewRepository.getChildrenEngagementMetrics(),
      this.overviewRepository.getChildrenGenderDistribution(),
      this.overviewRepository.getGeographicDistribution(),
    ]);

    const threeMonthsAgoChildCount =
      await this.overviewRepository.getChildrenCountAt(threeMonthsAgoStr);
    const childrenGrowthRate = growthRate(
      totalCounts.totalChildren,
      threeMonthsAgoChildCount,
    );

    const threeMonthsAgoAcceptedChrists =
      await this.overviewRepository.getAcceptedChristsCountBetween(
        sixMonthsGrowthStartStr,
        threeMonthsAgoStr,
      );
    const decisionsGrowthRate = growthRate(
      acceptedChristsLast3Months.totalDecisions,
      threeMonthsAgoAcceptedChrists,
    );

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

      indicators: {
        clubsWithLowAttendance: clubsPerformanceMetrics.clubsWithLowAttendance,
        childrenWithLowEngagement:
          childrenEngagementMetrics.childrenWithLowEngagement,
        clubsMissingPagelas: clubsPerformanceMetrics.clubsMissingPagelas,
        growthRate: {
          children: roundToOneDecimal(childrenGrowthRate),
          decisions: roundToOneDecimal(decisionsGrowthRate),
        },
      },

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
      this.pagelasRepository.getPagelasOverallStats(filters),
      this.pagelasRepository.getPagelasWeeklyStats(filters),
      this.pagelasRepository.getPagelasTopPerformers(filters, 10),
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
      this.acceptedChristsRepository.getAcceptedChristsOverallStats(filters),
      this.acceptedChristsRepository.getAcceptedChristsByPeriod(filters),
      this.acceptedChristsRepository.getRecentAcceptedChrists(filters, 10),
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

  async getChildrenStats(
    filters: ChildrenStatsQueryDto,
  ): Promise<ChildrenStatsResponseDto> {
    const processedFilters = this.periodService.applyPeriodFilter(filters);

    const childrenData =
      await this.childrenRepository.getChildrenWithStats(processedFilters);

    const children = childrenData.allFilteredChildren;
    const pagelasStats = childrenData.pagelasStats;
    const decisionsMap = childrenData.decisionsMap;
    const totalCount = childrenData.totalCount;
    const filteredCount = childrenData.filteredCount;
    const page = childrenData.page;
    const limit = childrenData.limit;

    let sumAge = 0;
    let sumEngagement = 0;
    let sumPresenceRate = 0;
    let childrenWithDecisions = 0;
    let activeChildren = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const allChildrenWithStats = children.map((child, index) => {
      const age = ageInYears(child.birthDate);
      const monthsParticipating = countMonthsParticipating(child.joinedAt);
      const participationTimeRange =
        toParticipationTimeRange(monthsParticipating);

      const stats = pagelasStats.get(child.id);
      const totalPagelas = toCount(stats?.totalPagelas);
      const presenceCount = toCount(stats?.presenceCount);
      const meditationCount = toCount(stats?.meditationCount);
      const verseCount = toCount(stats?.verseCount);

      const presenceRate = percentage(presenceCount, totalPagelas);
      const meditationRate = percentage(meditationCount, totalPagelas);
      const verseRecitationRate = percentage(verseCount, totalPagelas);

      const engagementScore = calcEngagementScore({
        presenceCount,
        meditationCount,
        verseCount,
        totalPagelas,
      });

      const decision = decisionsMap.get(child.id);
      const hasDecision = !!decision;
      const totalDecisions = toCount(decision?.totalDecisions);

      const lastActivity = stats?.lastActivity || null;
      const isActive = lastActivity
        ? new Date(lastActivity) >= new Date(thirtyDaysAgoStr)
        : false;

      const consecutiveWeeks = consecutiveAcademicWeeks(stats?.weekKeys);

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
          presenceRate: roundToOneDecimal(presenceRate),
          meditationRate: roundToOneDecimal(meditationRate),
          verseRecitationRate: roundToOneDecimal(verseRecitationRate),
          engagementScore: roundToOneDecimal(engagementScore),
          lastPagelaDate: lastActivity ? String(lastActivity) : null,
          consecutiveWeeks,
        },
        decisions: {
          hasDecision,
          decisionType: decision?.lastDecision || null,
          decisionDate: decision?.lastDecisionDate || null,
          totalDecisions,
        },
        isActive,
        rank: index + 1,
      };
    });

    const pageStart = (page - 1) * limit;
    const childrenWithStats = allChildrenWithStats.slice(
      pageStart,
      pageStart + limit,
    );

    const toPercentage = (count: number) => percentage(count, filteredCount);
    const genderCounts = new Map<string, number>();
    const ageGroupCounts = new Map<string, number>();
    const clubCounts = new Map<
      string,
      { clubId: string; clubNumber: number; count: number }
    >();
    const cityCounts = new Map<string, { state: string; count: number }>();
    const participationCounts = new Map<string, number>();

    allChildrenWithStats.forEach((child) => {
      genderCounts.set(child.gender, (genderCounts.get(child.gender) || 0) + 1);

      const ageGroup = toAgeGroup(child.age);
      ageGroupCounts.set(ageGroup, (ageGroupCounts.get(ageGroup) || 0) + 1);

      if (child.club) {
        const current = clubCounts.get(child.club.id) || {
          clubId: child.club.id,
          clubNumber: child.club.number,
          count: 0,
        };
        current.count++;
        clubCounts.set(child.club.id, current);
      }

      if (child.address?.city) {
        const current = cityCounts.get(child.address.city) || {
          state: child.address.state || 'N/A',
          count: 0,
        };
        current.count++;
        cityCounts.set(child.address.city, current);
      }

      participationCounts.set(
        child.participationTimeRange,
        (participationCounts.get(child.participationTimeRange) || 0) + 1,
      );
    });

    const distribution = {
      byGender: Array.from(genderCounts.entries()).map(([gender, count]) => ({
        gender,
        count,
        percentage: toPercentage(count),
      })),
      byAgeGroup: Array.from(ageGroupCounts.entries()).map(
        ([ageGroup, count]) => ({
          ageGroup,
          count,
          percentage: toPercentage(count),
        }),
      ),
      byClub: Array.from(clubCounts.values()).map((club) => ({
        ...club,
        percentage: toPercentage(club.count),
      })),
      byCity: Array.from(cityCounts.entries()).map(([city, data]) => ({
        city,
        state: data.state,
        count: data.count,
        percentage: toPercentage(data.count),
      })),
      byParticipationTime: Array.from(participationCounts.entries()).map(
        ([timeRange, count]) => ({
          timeRange,
          count,
          percentage: toPercentage(count),
        }),
      ),
    };

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
        avgEngagementScore: roundToOneDecimal(
          average(sumEngagement, filteredCount),
        ),
        avgPresenceRate: roundToOneDecimal(
          average(sumPresenceRate, filteredCount),
        ),
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
    const processedFilters = this.periodService.applyPeriodFilter(filters);

    const clubsData =
      await this.clubsTeachersRepository.getClubsWithStats(processedFilters);
    const clubs = clubsData.allFilteredClubs;
    const childrenResults = clubsData.allChildrenResults;
    const pagelasResults = clubsData.allPagelasResults;
    const decisionsResults = clubsData.allDecisionsResults;
    const teachers = clubsData.allTeachers;
    const totalCount = clubsData.totalCount;
    const page = clubsData.page;
    const limit = clubsData.limit;
    const inactiveClubs = clubsData.inactiveClubs;
    const inactiveChildren = clubsData.inactiveChildren;

    const childrenByClub: Map<
      string,
      { total: number; M: number; F: number; ageTotal: number }
    > = new Map();
    childrenResults.forEach((r) => {
      if (!childrenByClub.has(r.clubId)) {
        childrenByClub.set(r.clubId, {
          total: 0,
          M: 0,
          F: 0,
          ageTotal: 0,
        });
      }
      const data = childrenByClub.get(r.clubId);
      if (data) {
        const count = toCount(r.total);
        data.total += count;
        data.ageTotal += Number(r.avgAge || 0) * count;
        if (r.gender === 'M') data.M = count;
        if (r.gender === 'F') data.F = count;
      }
    });

    const pagelasByClub = new Map<string, PagelasByClubRaw>(
      pagelasResults.map((p) => [p.clubId, p]),
    );
    const decisionsByClub = new Map<string, AcceptedChristsByClubRaw>(
      decisionsResults.map((d) => [d.clubId, d]),
    );
    const teachersByClub = new Map<string, TeacherProfileEntity[]>();

    teachers.forEach((t) => {
      if (t.club) {
        if (!teachersByClub.has(t.club.id)) {
          teachersByClub.set(t.club.id, []);
        }
        teachersByClub.get(t.club.id)?.push(t);
      }
    });

    const allClubsWithStats = clubs.map((club, index) => {
      const children = childrenByClub.get(club.id) || {
        total: 0,
        M: 0,
        F: 0,
        ageTotal: 0,
      };
      const pagelas = pagelasByClub.get(club.id);
      const decisions = decisionsByClub.get(club.id);
      const clubTeachers = teachersByClub.get(club.id) || [];

      const totalPagelas = toCount(pagelas?.totalPagelas);
      const presenceCount = toCount(pagelas?.presenceCount);
      const meditationCount = toCount(pagelas?.meditationCount);
      const verseCount = toCount(pagelas?.verseCount);

      const presenceRate = percentage(presenceCount, totalPagelas);
      const meditationRate = percentage(meditationCount, totalPagelas);
      const verseRate = percentage(verseCount, totalPagelas);

      const activeChildren = toCount(pagelas?.activeChildren);
      const activityRate = percentage(activeChildren, children.total);
      const decisionRate = percentage(
        toCount(decisions?.childrenWithDecisions),
        activeChildren,
      );

      const performanceScore = calcClubPerformanceScore({
        presenceRate,
        meditationRate,
        activityRate,
        decisionRate,
      });

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
          avgAge: roundToOneDecimal(average(children.ageTotal, children.total)),
          withDecisions: toCount(decisions?.childrenWithDecisions),
        },
        teachers: {
          total: clubTeachers.length,
          active: toCount(pagelas?.activeTeachers),
          list: clubTeachers.map((t) => ({
            id: t.id,
            name: t.user?.name || 'N/A',
          })),
        },
        performance: {
          totalPagelas,
          presenceRate: roundToOneDecimal(presenceRate),
          meditationRate: roundToOneDecimal(meditationRate),
          verseRecitationRate: roundToOneDecimal(verseRate),
          performanceScore: roundToOneDecimal(performanceScore),
          totalDecisions: toCount(decisions?.totalDecisions),
        },
        lastActivity: pagelas?.lastActivity
          ? {
              date: new Date(pagelas.lastActivity).toISOString(),
              type: 'pagela',
            }
          : null,
        rank: index + 1,
      };
    });

    const pageStart = (page - 1) * limit;
    const clubsWithStats = allClubsWithStats.slice(
      pageStart,
      pageStart + limit,
    );

    const byCity = new Map<string, { state: string; count: number }>();
    const byWeekday = new Map<string, number>();
    const byCoordinator = new Map<string, { name: string; count: number }>();
    const byPerformance = new Map<string, number>([
      ['0-50', 0],
      ['50-70', 0],
      ['70-85', 0],
      ['85-100', 0],
    ]);

    allClubsWithStats.forEach((club) => {
      const cityKey = club.address.city || 'N/A';
      if (!byCity.has(cityKey)) {
        byCity.set(cityKey, { state: club.address.state || 'N/A', count: 0 });
      }
      const cityEntry = byCity.get(cityKey);
      if (cityEntry) cityEntry.count++;

      const weekdayKey = String(club.weekday);
      byWeekday.set(weekdayKey, (byWeekday.get(weekdayKey) || 0) + 1);

      if (club.coordinator) {
        const coordKey = club.coordinator.id;
        if (!byCoordinator.has(coordKey)) {
          byCoordinator.set(coordKey, {
            name: club.coordinator.name,
            count: 0,
          });
        }
        const coordEntry = byCoordinator.get(coordKey);
        if (coordEntry) coordEntry.count++;
      }

      const score = club.performance.performanceScore;
      if (score < 50)
        byPerformance.set('0-50', (byPerformance.get('0-50') || 0) + 1);
      else if (score < 70)
        byPerformance.set('50-70', (byPerformance.get('50-70') || 0) + 1);
      else if (score < 85)
        byPerformance.set('70-85', (byPerformance.get('70-85') || 0) + 1);
      else byPerformance.set('85-100', (byPerformance.get('85-100') || 0) + 1);
    });

    const totalFiltered = allClubsWithStats.length;
    const totalPages = Math.ceil(totalCount / limit);

    const summary = {
      totalClubs: totalCount,
      filteredClubs: totalFiltered,
      totalChildren: allClubsWithStats.reduce(
        (sum, c) => sum + c.children.total,
        0,
      ),
      totalTeachers: allClubsWithStats.reduce(
        (sum, c) => sum + c.teachers.total,
        0,
      ),
      avgPerformanceScore: averageOf(
        allClubsWithStats,
        (c) => c.performance.performanceScore,
      ),
      avgPresenceRate: averageOf(
        allClubsWithStats,
        (c) => c.performance.presenceRate,
      ),
      totalDecisions: allClubsWithStats.reduce(
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
          percentage: percentage(data.count, totalFiltered),
        })),
        byWeekday: Array.from(byWeekday.entries()).map(([weekday, count]) => ({
          weekday,
          count,
          percentage: percentage(count, totalFiltered),
        })),
        byCoordinator: Array.from(byCoordinator.entries()).map(
          ([id, data]) => ({
            coordinatorId: id,
            coordinatorName: data.name,
            count: data.count,
            percentage: percentage(data.count, totalFiltered),
          }),
        ),
        byPerformance: Array.from(byPerformance.entries()).map(
          ([range, count]) => ({
            range,
            count,
            percentage: percentage(count, totalFiltered),
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
    const processedFilters = this.periodService.applyPeriodFilter(filters);

    const teachersData =
      await this.clubsTeachersRepository.getTeachersWithStats(processedFilters);
    const { totalCount, page, limit } = teachersData;
    const teachers = teachersData.allFilteredTeachers;
    const pagelasResults = teachersData.allPagelasResults;
    const decisionsResults = teachersData.allDecisionsResults;

    const pagelasByTeacher = new Map<string, TeacherStatsRaw>(
      pagelasResults.map((p) => [p.teacherId, p]),
    );
    const decisionsByTeacher = new Map<string, TeacherDecisionStatsRaw>(
      decisionsResults.map((d) => [d.teacherId, d]),
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const allTeachersWithStats = teachers.map((teacher, index) => {
      const pagelas = pagelasByTeacher.get(teacher.id);
      const decisions = decisionsByTeacher.get(teacher.id);

      const totalPagelas = toCount(pagelas?.totalPagelas);
      const uniqueChildren = toCount(pagelas?.uniqueChildren);
      const activeChildren = toCount(pagelas?.activeChildren);
      const presenceCount = toCount(pagelas?.presenceCount);
      const meditationCount = toCount(pagelas?.meditationCount);
      const verseCount = toCount(pagelas?.verseCount);

      const avgPresenceRate = percentage(presenceCount, totalPagelas);
      const avgMeditationRate = percentage(meditationCount, totalPagelas);
      const avgVerseRate = percentage(verseCount, totalPagelas);

      const childrenWithDecisions = toCount(decisions?.childrenWithDecisions);
      const decisionRate = percentage(childrenWithDecisions, uniqueChildren);

      const effectivenessScore =
        avgPresenceRate * 0.3 +
        avgMeditationRate * 0.3 +
        avgVerseRate * 0.2 +
        decisionRate * 0.2;

      const lastActivity = pagelas?.lastActivity;
      const isActive = lastActivity
        ? new Date(lastActivity) >= new Date(thirtyDaysAgoStr)
        : false;

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
          active: activeChildren,
          withDecisions: childrenWithDecisions,
          avgEngagement:
            Math.round(
              (avgPresenceRate * 0.3 +
                avgMeditationRate * 0.35 +
                avgVerseRate * 0.35) *
                10,
            ) / 10,
        },
        performance: {
          totalPagelas,
          avgPresenceRate: roundToOneDecimal(avgPresenceRate),
          avgMeditationRate: roundToOneDecimal(avgMeditationRate),
          avgVerseRate: roundToOneDecimal(avgVerseRate),
          effectivenessScore: roundToOneDecimal(effectivenessScore),
        },
        lastActivity: lastActivity
          ? {
              date: new Date(lastActivity).toISOString(),
              totalPagelas,
            }
          : null,
        isActive,
        rank: index + 1,
      };
    });

    const pageStart = (page - 1) * limit;
    const teachersWithStats = allTeachersWithStats.slice(
      pageStart,
      pageStart + limit,
    );

    const byClub = new Map<string, { number: number; count: number }>();
    const byCity = new Map<string, { state: string; count: number }>();
    const byEffectiveness = new Map<string, number>([
      ['0-50', 0],
      ['50-70', 0],
      ['70-85', 0],
      ['85-100', 0],
    ]);

    allTeachersWithStats.forEach((teacher) => {
      if (teacher.club) {
        const clubKey = teacher.club.id;
        if (!byClub.has(clubKey)) {
          byClub.set(clubKey, { number: teacher.club.number, count: 0 });
        }
        const clubEntry = byClub.get(clubKey);
        if (clubEntry) clubEntry.count++;

        const cityKey = teacher.club.city;
        if (!byCity.has(cityKey)) {
          byCity.set(cityKey, { state: teacher.club.state, count: 0 });
        }
        const cityEntry = byCity.get(cityKey);
        if (cityEntry) cityEntry.count++;
      }

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

    const totalFiltered = allTeachersWithStats.length;
    const totalPages = Math.ceil(totalCount / limit);

    const summary = {
      totalTeachers: totalCount,
      filteredTeachers: totalFiltered,
      activeTeachers: allTeachersWithStats.filter((t) => t.isActive).length,
      totalChildren: allTeachersWithStats.reduce(
        (sum, t) => sum + t.children.total,
        0,
      ),
      avgEffectivenessScore:
        totalFiltered > 0
          ? Math.round(
              (allTeachersWithStats.reduce(
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
              (allTeachersWithStats.reduce(
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
          percentage: percentage(data.count, totalFiltered),
        })),
        byCity: Array.from(byCity.entries()).map(([city, data]) => ({
          city,
          state: data.state,
          count: data.count,
          percentage: percentage(data.count, totalFiltered),
        })),
        byEffectiveness: Array.from(byEffectiveness.entries()).map(
          ([range, count]) => ({
            range,
            count,
            percentage: percentage(count, totalFiltered),
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
  ): Promise<ClubAttendanceAnalysisDto> {
    return this.attendanceRepository.analyzeClubAttendance(
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
  ): Promise<WeeklyAttendanceDto> {
    return this.attendanceRepository.analyzeWeeklyAttendance(
      year,
      week,
      page,
      limit,
    );
  }
}
