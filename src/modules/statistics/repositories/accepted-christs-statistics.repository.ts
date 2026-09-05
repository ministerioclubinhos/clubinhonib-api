import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { DecisionType } from '../../accepted-christs/enums/decision-type.enum';
import { StatisticsFiltersService } from '../services/statistics-filters.service';
import { AcceptedChristsStatsQueryDto } from '../dto/accepted-christs-stats-query.dto';
import {
  AcceptedChristsByCityRaw,
  AcceptedChristsByClubRaw,
  AcceptedChristsByGenderRaw,
  AcceptedChristsByPeriodRaw,
  AcceptedChristsOverallStatsRaw,
  AcceptedChristsTimeSeriesRaw,
  AcceptedAgeGroupStats,
  AcceptedParticipationTimeStats,
} from '../dto/statistics-raw-results.dto';
import {
  ageGroup as toAgeGroup,
  ageInYears,
  monthsParticipating as countMonthsParticipating,
  participationTimeRange as toParticipationTimeRange,
} from '../utils/metrics.utils';

/**
 * Consultas de decisões.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas. O bloco alcança uma tabela e o serviço de filtros, e nada
 * mais — por isso sai inteiro.
 */
@Injectable()
export class AcceptedChristsStatisticsRepository {
  constructor(
    @InjectRepository(AcceptedChristEntity)
    private readonly acceptedChristsRepository: Repository<AcceptedChristEntity>,
    private readonly filtersService: StatisticsFiltersService,
  ) {}

  async getAcceptedChristsOverallStats(filters: AcceptedChristsStatsQueryDto) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('1=1')
      .select('COUNT(ac.id)', 'totalDecisions')
      .addSelect('COUNT(DISTINCT ac.child.id)', 'uniqueChildren')
      .addSelect('ac.decision', 'decision');

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    query.groupBy('ac.decision');

    const results = await query.getRawMany<AcceptedChristsOverallStatsRaw>();

    const byDecisionType: { [key: string]: number } = {};
    let totalDecisions = 0;

    results.forEach((row) => {
      const count = parseInt(row.totalDecisions);
      totalDecisions += count;
      if (row.decision) {
        byDecisionType[row.decision] = count;
      }
    });

    const uniqueQuery = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('1=1')
      .select('COUNT(DISTINCT ac.child.id)', 'uniqueChildren');

    this.filtersService.applyAcceptedChristsFilters(uniqueQuery, filters);

    const uniqueResult = await uniqueQuery.getRawOne<{
      uniqueChildren: string;
    }>();

    return {
      totalDecisions,
      uniqueChildren: parseInt(uniqueResult?.uniqueChildren || '0'),
      byDecisionType,
    };
  }

  async getAcceptedChristsByPeriod(filters: AcceptedChristsStatsQueryDto) {
    const groupBy = filters.groupBy || 'month';

    let dateFormat: string;
    let groupByClause: string;

    switch (groupBy) {
      case 'day':
        dateFormat = 'DATE(ac.createdAt)';
        groupByClause = 'DATE(ac.createdAt)';
        break;
      case 'week':
        dateFormat =
          "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
        groupByClause =
          "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
        break;
      case 'year':
        dateFormat = 'YEAR(ac.createdAt)';
        groupByClause = 'YEAR(ac.createdAt)';
        break;
      case 'month':
      default:
        dateFormat = "DATE_FORMAT(ac.createdAt, '%Y-%m')";
        groupByClause = "DATE_FORMAT(ac.createdAt, '%Y-%m')";
        break;
    }

    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('1=1')
      .select(`${dateFormat}`, 'period')
      .addSelect('COUNT(ac.id)', 'totalDecisions')
      .addSelect('COUNT(DISTINCT ac.child.id)', 'uniqueChildren')
      .addSelect('ac.decision', 'decision')
      .groupBy(groupByClause)
      .addGroupBy('ac.decision')
      .orderBy('period', 'DESC');

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany<AcceptedChristsByPeriodRaw>();

    const periodMap = new Map<
      string,
      {
        period: string;
        totalDecisions: number;
        byDecisionType: Record<string, number>;
        uniqueChildren: number;
      }
    >();

    results.forEach((row) => {
      const { period } = row;
      if (!periodMap.has(period)) {
        periodMap.set(period, {
          period,
          totalDecisions: 0,
          byDecisionType: {},
          uniqueChildren: parseInt(row.uniqueChildren),
        });
      }

      const periodData = periodMap.get(period)!;
      const count = parseInt(row.totalDecisions);
      periodData.totalDecisions += count;

      if (row.decision) {
        periodData.byDecisionType[row.decision] =
          (periodData.byDecisionType[row.decision] || 0) + count;
      }
    });

    return Array.from(periodMap.values());
  }

  async getRecentAcceptedChrists(
    filters: AcceptedChristsStatsQueryDto,
    limit: number = 10,
  ) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('1=1')
      .orderBy('ac.createdAt', 'DESC')
      .limit(limit);

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    const results = await query.getMany();

    return results.map((ac) => ({
      id: ac.id,
      childId: ac.child.id,
      childName: ac.child.name,
      decision: ac.decision,
      createdAt: ac.createdAt,
      notes: ac.notes,
    }));
  }

  async getAcceptedChristsByGender(filters: AcceptedChristsStatsQueryDto) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('1=1')
      .select('child.gender', 'gender')
      .addSelect('COUNT(ac.id)', 'total')
      .addSelect(
        'SUM(CASE WHEN ac.decision = "ACCEPTED" THEN 1 ELSE 0 END)',
        'accepted',
      )
      .addSelect(
        'SUM(CASE WHEN ac.decision = "RECONCILED" THEN 1 ELSE 0 END)',
        'reconciled',
      )
      .groupBy('child.gender');

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany<AcceptedChristsByGenderRaw>();

    return results.map((row) => ({
      gender: row.gender,
      total: parseInt(row.total),
      accepted: parseInt(row.accepted),
      reconciled: parseInt(row.reconciled),
    }));
  }

  async getAcceptedChristsByAgeGroup(filters: AcceptedChristsStatsQueryDto) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('1=1');

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    const decisions = await query.getMany();

    const ageGroups = new Map<string, AcceptedAgeGroupStats>();

    decisions.forEach((ac) => {
      const age = ageInYears(ac.child.birthDate);
      const ageGroup = toAgeGroup(age);

      if (!ageGroups.has(ageGroup)) {
        ageGroups.set(ageGroup, {
          ageGroup,
          total: 0,
          accepted: 0,
          reconciled: 0,
        });
      }

      const group = ageGroups.get(ageGroup)!;
      group.total++;
      if (ac.decision === DecisionType.ACCEPTED) group.accepted++;
      if (ac.decision === DecisionType.RECONCILED) group.reconciled++;
    });

    return Array.from(ageGroups.values());
  }

  async getAcceptedChristsByClub(filters: AcceptedChristsStatsQueryDto) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.id IS NOT NULL')

      .select('club.id', 'clubId')
      .addSelect('club.number', 'clubNumber')
      .addSelect('COUNT(ac.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(
        'SUM(CASE WHEN ac.decision = "ACCEPTED" THEN 1 ELSE 0 END)',
        'accepted',
      )
      .addSelect(
        'SUM(CASE WHEN ac.decision = "RECONCILED" THEN 1 ELSE 0 END)',
        'reconciled',
      )
      .groupBy('club.id')
      .addGroupBy('club.number')
      .orderBy('clubNumber', 'ASC');

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany<AcceptedChristsByClubRaw>();

    return results.map((row) => ({
      clubId: row.clubId,
      clubNumber: parseInt(row.clubNumber),
      total: parseInt(row.total),
      uniqueChildren: parseInt(row.uniqueChildren),
      accepted: parseInt(row.accepted),
      reconciled: parseInt(row.reconciled),
    }));
  }

  async getAcceptedChristsByCity(filters: AcceptedChristsStatsQueryDto) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('address.city IS NOT NULL')
      .select('address.city', 'city')
      .addSelect('address.state', 'state')
      .addSelect('COUNT(ac.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(
        'SUM(CASE WHEN ac.decision = "ACCEPTED" THEN 1 ELSE 0 END)',
        'accepted',
      )
      .addSelect(
        'SUM(CASE WHEN ac.decision = "RECONCILED" THEN 1 ELSE 0 END)',
        'reconciled',
      )
      .groupBy('address.city')
      .addGroupBy('address.state')
      .orderBy('total', 'DESC');

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany<AcceptedChristsByCityRaw>();

    return results.map((row) => ({
      city: row.city,
      state: row.state,
      total: parseInt(row.total),
      uniqueChildren: parseInt(row.uniqueChildren),
      accepted: parseInt(row.accepted),
      reconciled: parseInt(row.reconciled),
    }));
  }

  async getAcceptedChristsByParticipationTime(
    filters: AcceptedChristsStatsQueryDto,
  ) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('1=1');

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    const decisions = await query.getMany();

    const timeGroups = new Map<string, AcceptedParticipationTimeStats>();

    decisions.forEach((ac) => {
      const months = countMonthsParticipating(ac.child.joinedAt);
      const timeRange = toParticipationTimeRange(months);

      if (!timeGroups.has(timeRange)) {
        timeGroups.set(timeRange, {
          timeRange,
          total: 0,
          accepted: 0,
          reconciled: 0,
          childrenMonths: [],
        });
      }

      const group = timeGroups.get(timeRange)!;
      group.total++;
      if (ac.decision === DecisionType.ACCEPTED) group.accepted++;
      if (ac.decision === DecisionType.RECONCILED) group.reconciled++;
      group.childrenMonths.push(months);
    });

    const uniqueChildrenByRange = new Map<string, Set<string>>();
    decisions.forEach((ac) => {
      const months = countMonthsParticipating(ac.child.joinedAt);
      const timeRange = toParticipationTimeRange(months);
      if (!uniqueChildrenByRange.has(timeRange)) {
        uniqueChildrenByRange.set(timeRange, new Set());
      }
      uniqueChildrenByRange.get(timeRange)!.add(ac.child.id);
    });

    const orderedRanges = ['0-3 meses', '3-6 meses', '6-12 meses', '1+ ano'];

    return orderedRanges
      .filter((range) => timeGroups.has(range))
      .map((range) => {
        const group = timeGroups.get(range)!;
        const avgMonths =
          group.childrenMonths.length > 0
            ? group.childrenMonths.reduce((a: number, b: number) => a + b, 0) /
              group.childrenMonths.length
            : 0;

        return {
          timeRange: group.timeRange,
          total: group.total,
          uniqueChildren: uniqueChildrenByRange.get(range)?.size || 0,
          accepted: group.accepted,
          reconciled: group.reconciled,
          avgMonthsParticipating: Math.round(avgMonths * 10) / 10,
        };
      });
  }

  async getAcceptedChristsTimeSeries(filters: AcceptedChristsStatsQueryDto) {
    const groupBy = filters.groupBy || 'month';

    let dateFormat: string;
    let groupByClause: string;

    switch (groupBy) {
      case 'day':
        dateFormat = 'DATE(ac.createdAt)';
        groupByClause = 'DATE(ac.createdAt)';
        break;
      case 'week':
        dateFormat =
          "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
        groupByClause =
          "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
        break;
      case 'year':
        dateFormat = 'YEAR(ac.createdAt)';
        groupByClause = 'YEAR(ac.createdAt)';
        break;
      case 'month':
      default:
        dateFormat = "DATE_FORMAT(ac.createdAt, '%Y-%m')";
        groupByClause = "DATE_FORMAT(ac.createdAt, '%Y-%m')";
        break;
    }

    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('1=1')
      .select(`${dateFormat}`, 'period')
      .addSelect('COUNT(ac.id)', 'total')
      .addSelect(
        'SUM(CASE WHEN ac.decision = "ACCEPTED" THEN 1 ELSE 0 END)',
        'accepted',
      )
      .addSelect(
        'SUM(CASE WHEN ac.decision = "RECONCILED" THEN 1 ELSE 0 END)',
        'reconciled',
      )
      .groupBy(groupByClause)
      .orderBy('period', 'ASC');

    this.filtersService.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany<AcceptedChristsTimeSeriesRaw>();

    return results.map((row) => ({
      date: row.period,
      total: parseInt(row.total),
      accepted: parseInt(row.accepted),
      reconciled: parseInt(row.reconciled),
    }));
  }
}
