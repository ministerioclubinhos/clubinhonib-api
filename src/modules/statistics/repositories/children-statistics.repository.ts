import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { ChildEntity } from '../../children/entities/child.entity';
import { StatisticsFiltersService } from '../services/statistics-filters.service';
import { ChildrenStatsQueryDto } from '../dto/children-stats-query.dto';
import { PagelasStatsQueryDto } from '../dto/pagelas-stats-query.dto';
import {
  ChildDecisionStatsRaw,
  ChildPagelaStatsRaw,
  ChildrenWithStatsResult,
  ClubRankingStatsRaw,
  TopEngagedChildStatsRaw,
} from '../dto/statistics-raw-results.dto';
import {
  ageGroup as toAgeGroup,
  ageInYears,
  monthsParticipating as countMonthsParticipating,
  participationTimeRange as toParticipationTimeRange,
} from '../utils/metrics.utils';
import { toDateOnly } from '../utils/date.utils';

/**
 * Consultas de crianças, mais o ranking de clubinhos que a listagem de crianças reaproveita.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas.
 */
@Injectable()
export class ChildrenStatisticsRepository {
  constructor(
    @InjectRepository(PagelaEntity)
    private readonly pagelasRepository: Repository<PagelaEntity>,
    @InjectRepository(AcceptedChristEntity)
    private readonly acceptedChristsRepository: Repository<AcceptedChristEntity>,
    @InjectRepository(ChildEntity)
    private readonly childrenRepository: Repository<ChildEntity>,
    private readonly filtersService: StatisticsFiltersService,
  ) {}

  async getTopEngagedChildren(
    filters: PagelasStatsQueryDto,
    limit: number = 20,
  ) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoinAndSelect('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('child.id', 'childId')
      .addSelect('child.name', 'childName')
      .addSelect('child.gender', 'gender')
      .addSelect('child.birthDate', 'birthDate')
      .addSelect('child.joinedAt', 'joinedAt')
      .addSelect('club.number', 'clubNumber')
      .addSelect('address.city', 'city')
      .addSelect('address.state', 'state')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presenceCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'verseCount',
      )
      .groupBy('child.id')
      .addGroupBy('child.name')
      .addGroupBy('child.gender')
      .addGroupBy('child.birthDate')
      .addGroupBy('child.joinedAt')
      .addGroupBy('club.number')
      .addGroupBy('address.city')
      .addGroupBy('address.state')
      .orderBy('totalPagelas', 'DESC')
      .addOrderBy('presenceCount', 'DESC')
      .limit(limit);

    this.filtersService.applyPagelasFilters(query, filters);

    const results = await query.getRawMany<TopEngagedChildStatsRaw>();

    const childIds = results.map((r) => r.childId);
    const decisions =
      childIds.length > 0
        ? await this.acceptedChristsRepository
            .createQueryBuilder('ac')
            .leftJoinAndSelect('ac.child', 'child')
            .where('child.id IN (:...childIds)', { childIds })
            .getMany()
        : [];

    const decisionsMap = new Map<string, string | null>();
    decisions.forEach((d) => {
      if (d.child) {
        decisionsMap.set(d.child.id, d.decision);
      }
    });

    return results.map((row) => {
      const totalPagelas = parseInt(row.totalPagelas);
      const presenceCount = parseInt(row.presenceCount);
      const meditationCount = parseInt(row.meditationCount);
      const verseCount = parseInt(row.verseCount);
      const age = ageInYears(row.birthDate!);

      const engagementScore =
        totalPagelas > 0
          ? ((presenceCount * 0.3 +
              meditationCount * 0.35 +
              verseCount * 0.35) /
              totalPagelas) *
            100
          : 0;

      const monthsParticipating = countMonthsParticipating(row.joinedAt);

      return {
        childId: row.childId,
        childName: row.childName,
        gender: row.gender!,
        age,
        clubNumber: row.clubNumber,
        city: row.city || null,
        state: row.state || null,
        monthsParticipating,
        engagementScore: Math.round(engagementScore * 10) / 10,
        totalPagelas,
        presenceRate:
          totalPagelas > 0 ? (presenceCount / totalPagelas) * 100 : 0,
        hasDecision: decisionsMap.has(row.childId),
        decisionType: decisionsMap.get(row.childId) || null,
      };
    });
  }

  async getClubRankings(filters: PagelasStatsQueryDto) {
    const pagelasQuery = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.address', 'address')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.id IS NOT NULL')
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('club.id', 'clubId')
      .addSelect('club.number', 'clubNumber')
      .addSelect('address.city', 'city')
      .addSelect('COUNT(DISTINCT child.id)', 'activeChildren')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presenceCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditationCount',
      )
      .groupBy('club.id')
      .addGroupBy('club.number')
      .addGroupBy('address.city');

    this.filtersService.applyPagelasFilters(pagelasQuery, filters);

    const pagelasResults = await pagelasQuery.getRawMany<ClubRankingStatsRaw>();

    const clubIds = pagelasResults.map((r) => r.clubId);
    const childrenCounts =
      clubIds.length > 0
        ? await this.childrenRepository
            .createQueryBuilder('child')
            .select('child.club.id', 'clubId')
            .addSelect('COUNT(child.id)', 'totalChildren')
            .leftJoin('child.club', 'club')
            .where('child.club.id IN (:...clubIds)', { clubIds })
            .andWhere('club.isActive = :clubActive', { clubActive: true })
            .andWhere('child.isActive = :isActive', { isActive: true })
            .groupBy('child.club.id')
            .getRawMany<{ clubId: string; totalChildren: string }>()
        : [];

    const childrenMap = new Map(
      childrenCounts.map((c) => [c.clubId, parseInt(c.totalChildren)]),
    );

    const decisionsQuery = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .select('club.id', 'clubId')
      .addSelect('COUNT(ac.id)', 'totalDecisions')
      .where('club.id IN (:...clubIds)', { clubIds })
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .groupBy('club.id');

    const decisionsResults =
      clubIds.length > 0
        ? await decisionsQuery.getRawMany<{
            clubId: string;
            totalDecisions: string;
          }>()
        : [];
    const decisionsMap = new Map(
      decisionsResults.map((d) => [d.clubId, parseInt(d.totalDecisions)]),
    );

    return pagelasResults
      .map((row) => {
        const totalPagelas = parseInt(row.totalPagelas);
        const presenceCount = parseInt(row.presenceCount);
        const meditationCount = parseInt(row.meditationCount);
        const totalChildren = childrenMap.get(row.clubId) || 0;
        const activeChildren = parseInt(row.activeChildren);
        const totalDecisions = decisionsMap.get(row.clubId) || 0;

        const avgPresenceRate =
          totalPagelas > 0 ? (presenceCount / totalPagelas) * 100 : 0;
        const avgMeditationRate =
          totalPagelas > 0 ? (meditationCount / totalPagelas) * 100 : 0;
        const activityRate =
          totalChildren > 0 ? (activeChildren / totalChildren) * 100 : 0;
        const decisionRate =
          activeChildren > 0 ? (totalDecisions / activeChildren) * 100 : 0;

        const performanceScore =
          avgPresenceRate * 0.3 +
          avgMeditationRate * 0.3 +
          activityRate * 0.2 +
          decisionRate * 0.2;

        return {
          clubId: row.clubId,
          clubNumber: row.clubNumber,
          city: row.city || 'N/A',
          totalChildren,
          activeChildren,
          avgPresenceRate: Math.round(avgPresenceRate * 10) / 10,
          avgMeditationRate: Math.round(avgMeditationRate * 10) / 10,
          totalDecisions,
          performanceScore: Math.round(performanceScore * 10) / 10,
        };
      })
      .sort((a, b) => b.performanceScore - a.performanceScore);
  }

  async getChildrenWithStats(
    filters: ChildrenStatsQueryDto,
  ): Promise<ChildrenWithStatsResult> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.childrenRepository
      .createQueryBuilder('child')
      .leftJoinAndSelect('child.club', 'club')
      .leftJoinAndSelect('child.address', 'address')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true });

    query.andWhere('child.isActive = :isActive', { isActive: true });

    if (filters.clubId) {
      query.andWhere('club.id = :clubId', { clubId: filters.clubId });
    }

    if (filters.coordinatorId) {
      query.andWhere('coordinator.id = :coordinatorId', {
        coordinatorId: filters.coordinatorId,
      });
    }

    if (filters.gender) {
      query.andWhere('child.gender = :gender', { gender: filters.gender });
    }

    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const today = new Date();
      if (filters.maxAge !== undefined) {
        const minBirthDate = new Date(
          today.getFullYear() - filters.maxAge - 1,
          today.getMonth(),
          today.getDate(),
        );
        query.andWhere('child.birthDate >= :minBirthDate', {
          minBirthDate: toDateOnly(minBirthDate),
        });
      }
      if (filters.minAge !== undefined) {
        const maxBirthDate = new Date(
          today.getFullYear() - filters.minAge,
          today.getMonth(),
          today.getDate(),
        );
        query.andWhere('child.birthDate <= :maxBirthDate', {
          maxBirthDate: toDateOnly(maxBirthDate),
        });
      }
    }

    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }

    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }

    if (filters.district) {
      query.andWhere('address.district = :district', {
        district: filters.district,
      });
    }

    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', {
        joinedAfter: filters.joinedAfter,
      });
    }

    if (filters.joinedBefore) {
      const joinedBeforeExclusive = new Date(
        `${filters.joinedBefore}T00:00:00Z`,
      );
      joinedBeforeExclusive.setUTCDate(joinedBeforeExclusive.getUTCDate() + 1);
      query.andWhere('child.joinedAt < :joinedBeforeExclusive', {
        joinedBeforeExclusive: toDateOnly(joinedBeforeExclusive),
      });
    }

    if (filters.search) {
      query.andWhere('child.name LIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    if (filters.isNewcomer) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = toDateOnly(threeMonthsAgo);
      query.andWhere('child.joinedAt >= :threeMonthsAgo', {
        threeMonthsAgo: threeMonthsAgoStr,
      });
    }

    if (filters.isVeteran) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = toDateOnly(oneYearAgo);
      query.andWhere('child.joinedAt <= :oneYearAgo', {
        oneYearAgo: oneYearAgoStr,
      });
    }

    if (filters.sortBy === 'age') {
      query.orderBy(
        'child.birthDate',
        filters.sortOrder === 'ASC' ? 'DESC' : 'ASC',
      );
    } else if (filters.sortBy === 'name') {
      query.orderBy('child.name', filters.sortOrder || 'ASC');
    } else {
      query.orderBy('child.name', 'ASC');
    }

    const children = await query.getMany();
    const childIds = children.map((c) => c.id);

    if (childIds.length === 0) {
      return {
        children: [],
        allFilteredChildren: [],
        pagelasStats: new Map(),
        decisionsMap: new Map(),
        totalCount: 0,
        filteredCount: 0,
        page,
        limit,
      };
    }

    let pagelasStats = new Map<string, ChildPagelaStatsRaw>();
    const pagelasQuery = this.pagelasRepository
      .createQueryBuilder('pagela')
      .select('pagela.child.id', 'childId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presenceCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'verseCount',
      )
      .addSelect('MAX(pagela.referenceDate)', 'lastActivity')
      .addSelect(
        "GROUP_CONCAT(DISTINCT CONCAT(pagela.year, '-', LPAD(pagela.week, 3, '0')) ORDER BY pagela.year DESC, pagela.week DESC)",
        'weekKeys',
      )
      .where('pagela.child.id IN (:...childIds)', { childIds })
      .groupBy('pagela.child.id');

    if (filters.year) {
      pagelasQuery.andWhere('pagela.year = :year', { year: filters.year });
    }
    if (filters.startDate) {
      pagelasQuery.andWhere('pagela.referenceDate >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      const endDateExclusive = new Date(`${filters.endDate}T00:00:00Z`);
      endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
      pagelasQuery.andWhere('pagela.referenceDate < :endDateExclusive', {
        endDateExclusive: toDateOnly(endDateExclusive),
      });
    }
    if (filters.teacherId) {
      pagelasQuery.andWhere('pagela.teacher.id = :teacherId', {
        teacherId: filters.teacherId,
      });
    }

    const pagelasResults = await pagelasQuery.getRawMany<ChildPagelaStatsRaw>();
    pagelasStats = new Map(pagelasResults.map((p) => [p.childId, p]));

    let decisionsMap = new Map<string, ChildDecisionStatsRaw>();
    const decisions = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .select('child.id', 'childId')
      .addSelect('COUNT(ac.id)', 'totalDecisions')
      .addSelect('MAX(ac.createdAt)', 'lastDecisionDate')
      .where('child.id IN (:...childIds)', { childIds })
      .groupBy('child.id');

    if (filters.decisionType) {
      decisions.andWhere('ac.decision = :decisionType', {
        decisionType: filters.decisionType,
      });
    }

    if (filters.startDate) {
      decisions.andWhere('ac.createdAt >= :decisionStartDate', {
        decisionStartDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      const decisionEndExclusive = new Date(`${filters.endDate}T00:00:00Z`);
      decisionEndExclusive.setUTCDate(decisionEndExclusive.getUTCDate() + 1);
      decisions.andWhere('ac.createdAt < :decisionEndExclusive', {
        decisionEndExclusive: toDateOnly(decisionEndExclusive),
      });
    }

    const decisionsResults =
      await decisions.getRawMany<ChildDecisionStatsRaw>();

    if (decisionsResults.length > 0) {
      const latestDecisions = await this.acceptedChristsRepository
        .createQueryBuilder('ac')
        .leftJoin('ac.child', 'child')
        .select('child.id', 'childId')
        .addSelect('ac.decision', 'lastDecision')
        .addSelect('ac.createdAt', 'lastDecisionDate')
        .where('child.id IN (:...childIds)', { childIds })
        .orderBy('ac.createdAt', 'DESC')
        .getRawMany<ChildDecisionStatsRaw>();

      const latestByChild = new Map<string, ChildDecisionStatsRaw>();
      latestDecisions.forEach((decision) => {
        if (!latestByChild.has(decision.childId)) {
          latestByChild.set(decision.childId, decision);
        }
      });
      decisionsResults.forEach((decision) => {
        const latest = latestByChild.get(decision.childId);
        decision.lastDecision = latest?.lastDecision ?? null;
        decision.lastDecisionDate = latest?.lastDecisionDate ?? null;
      });
    }
    decisionsMap = new Map(decisionsResults.map((d) => [d.childId, d]));

    const totalCount = children.length;
    let filteredChildren = children;

    if (filters.minPagelas !== undefined) {
      filteredChildren = filteredChildren.filter((child) => {
        const stats = pagelasStats.get(child.id);
        return stats && parseInt(stats.totalPagelas) >= filters.minPagelas!;
      });
    }

    if (filters.minPresenceRate !== undefined) {
      filteredChildren = filteredChildren.filter((child) => {
        const stats = pagelasStats.get(child.id);
        if (!stats) return false;
        const presenceRate =
          parseInt(stats.totalPagelas) > 0
            ? (parseInt(stats.presenceCount) / parseInt(stats.totalPagelas)) *
              100
            : 0;
        return presenceRate >= filters.minPresenceRate!;
      });
    }

    if (filters.hasDecision !== undefined) {
      filteredChildren = filteredChildren.filter((child) => {
        const hasDecision = decisionsMap.has(child.id);
        return filters.hasDecision ? hasDecision : !hasDecision;
      });
    }

    if (filters.isActive !== undefined) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = toDateOnly(thirtyDaysAgo);

      filteredChildren = filteredChildren.filter((child) => {
        const stats = pagelasStats.get(child.id);
        if (!stats || !stats.lastActivity) return !filters.isActive;
        const lastActivityDate = new Date(stats.lastActivity);
        const thirtyDaysAgoDate = new Date(thirtyDaysAgoStr);
        const isActive = lastActivityDate >= thirtyDaysAgoDate;
        return filters.isActive ? isActive : !isActive;
      });
    }

    if (filters.ageGroup) {
      filteredChildren = filteredChildren.filter((child) => {
        const age = ageInYears(child.birthDate);
        const ageGroup = toAgeGroup(age);
        return ageGroup === filters.ageGroup;
      });
    }

    if (filters.hasLowEngagement) {
      filteredChildren = filteredChildren.filter((child) => {
        const stats = pagelasStats.get(child.id);
        if (!stats) return false;
        const total = parseInt(stats.totalPagelas);
        const present = parseInt(stats.presenceCount);
        const meditation = parseInt(stats.meditationCount);
        const verse = parseInt(stats.verseCount);
        const engagementScore =
          total > 0
            ? ((present * 0.3 + meditation * 0.35 + verse * 0.35) / total) * 100
            : 0;
        return engagementScore < 50;
      });
    }

    if (filters.maxEngagementScore !== undefined) {
      filteredChildren = filteredChildren.filter((child) => {
        const stats = pagelasStats.get(child.id);
        if (!stats) return true;
        const total = parseInt(stats.totalPagelas);
        const present = parseInt(stats.presenceCount);
        const meditation = parseInt(stats.meditationCount);
        const verse = parseInt(stats.verseCount);
        const engagementScore =
          total > 0
            ? ((present * 0.3 + meditation * 0.35 + verse * 0.35) / total) * 100
            : 0;
        return engagementScore <= filters.maxEngagementScore!;
      });
    }

    if (filters.maxPresenceRate !== undefined) {
      filteredChildren = filteredChildren.filter((child) => {
        const stats = pagelasStats.get(child.id);
        if (!stats) return true;
        const presenceRate =
          parseInt(stats.totalPagelas) > 0
            ? (parseInt(stats.presenceCount) / parseInt(stats.totalPagelas)) *
              100
            : 0;
        return presenceRate <= filters.maxPresenceRate!;
      });
    }

    if (filters.minEngagementScore !== undefined) {
      filteredChildren = filteredChildren.filter((child) => {
        const stats = pagelasStats.get(child.id);
        if (!stats) return false;
        const total = parseInt(stats.totalPagelas);
        const present = parseInt(stats.presenceCount);
        const meditation = parseInt(stats.meditationCount);
        const verse = parseInt(stats.verseCount);
        const engagementScore =
          total > 0
            ? ((present * 0.3 + meditation * 0.35 + verse * 0.35) / total) * 100
            : 0;
        return engagementScore >= filters.minEngagementScore!;
      });
    }

    if (
      filters.sortBy === 'engagementScore' ||
      filters.sortBy === 'presenceRate'
    ) {
      const order = filters.sortOrder === 'DESC' ? -1 : 1;
      filteredChildren.sort((a, b) => {
        const statsA = pagelasStats.get(a.id);
        const statsB = pagelasStats.get(b.id);

        const getScore = (
          stats: ChildPagelaStatsRaw | undefined,
          type: string,
        ) => {
          if (!stats) return 0;
          const total = parseInt(stats.totalPagelas);
          if (total === 0) return 0;

          if (type === 'presenceRate') {
            return (parseInt(stats.presenceCount) / total) * 100;
          } else {
            return (
              ((parseInt(stats.presenceCount) * 0.3 +
                parseInt(stats.meditationCount) * 0.35 +
                parseInt(stats.verseCount) * 0.35) /
                total) *
              100
            );
          }
        };

        const valA = getScore(statsA, filters.sortBy!);
        const valB = getScore(statsB, filters.sortBy!);

        if (valA < valB) return -1 * order;
        if (valA > valB) return 1 * order;
        return 0;
      });
    }

    const filteredCount = filteredChildren.length;
    const paginatedChildren = filteredChildren.slice(skip, skip + limit);

    return {
      children: paginatedChildren,
      allFilteredChildren: filteredChildren,
      pagelasStats,
      decisionsMap,
      totalCount,
      filteredCount,
      page,
      limit,
    };
  }

  async getChildrenStatsDistribution(filters: ChildrenStatsQueryDto) {
    const query = this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .leftJoin('child.address', 'address')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true });

    query.andWhere('child.isActive = :isActive', { isActive: true });

    if (filters.clubId) {
      query.andWhere('club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.coordinatorId) {
      query.andWhere('coordinator.id = :coordinatorId', {
        coordinatorId: filters.coordinatorId,
      });
    }
    if (filters.gender) {
      query.andWhere('child.gender = :gender', { gender: filters.gender });
    }
    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }
    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }
    if (filters.district) {
      query.andWhere('address.district = :district', {
        district: filters.district,
      });
    }
    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', {
        joinedAfter: filters.joinedAfter,
      });
    }
    if (filters.joinedBefore) {
      const joinedBeforeExclusive = new Date(
        `${filters.joinedBefore}T00:00:00Z`,
      );
      joinedBeforeExclusive.setUTCDate(joinedBeforeExclusive.getUTCDate() + 1);
      query.andWhere('child.joinedAt < :joinedBeforeExclusive', {
        joinedBeforeExclusive: toDateOnly(joinedBeforeExclusive),
      });
    }

    const children = await query.getMany();

    const byGender = new Map<string, number>();
    const byAgeGroup = new Map<string, number>();
    const byClub = new Map<
      string,
      { id: string; number: number; count: number }
    >();
    const byCity = new Map<string, { state: string; count: number }>();
    const byParticipationTime = new Map<string, number>();

    children.forEach((child) => {
      byGender.set(child.gender, (byGender.get(child.gender) || 0) + 1);

      const age = ageInYears(child.birthDate);
      const ageGroup = toAgeGroup(age);
      byAgeGroup.set(ageGroup, (byAgeGroup.get(ageGroup) || 0) + 1);

      if (child.club) {
        const clubKey = child.club.id;
        if (!byClub.has(clubKey)) {
          byClub.set(clubKey, {
            id: child.club.id,
            number: child.club.number,
            count: 0,
          });
        }
        byClub.get(clubKey)!.count++;
      }

      if (child.address?.city) {
        const cityKey = child.address.city;
        if (!byCity.has(cityKey)) {
          byCity.set(cityKey, {
            state: child.address?.state ?? 'N/A',
            count: 0,
          });
        }
        byCity.get(cityKey)!.count++;
      }

      const months = countMonthsParticipating(child.joinedAt);
      const timeRange = toParticipationTimeRange(months);
      byParticipationTime.set(
        timeRange,
        (byParticipationTime.get(timeRange) || 0) + 1,
      );
    });

    const total = children.length;

    return {
      byGender: Array.from(byGender.entries()).map(([gender, count]) => ({
        gender,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      })),
      byAgeGroup: Array.from(byAgeGroup.entries()).map(([ageGroup, count]) => ({
        ageGroup,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      })),
      byClub: Array.from(byClub.values()).map((club) => ({
        clubId: club.id,
        clubNumber: club.number,
        count: club.count,
        percentage: total > 0 ? (club.count / total) * 100 : 0,
      })),
      byCity: Array.from(byCity.entries()).map(([city, data]) => ({
        city,
        state: data.state,
        count: data.count,
        percentage: total > 0 ? (data.count / total) * 100 : 0,
      })),
      byParticipationTime: Array.from(byParticipationTime.entries()).map(
        ([timeRange, count]) => ({
          timeRange,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }),
      ),
    };
  }
}
