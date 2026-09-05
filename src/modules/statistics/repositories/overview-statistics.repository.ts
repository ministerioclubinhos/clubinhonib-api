import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { ChildEntity } from '../../children/entities/child.entity';
import { ClubEntity } from '../../clubs/entities/club.entity';
import { TeacherProfileEntity } from '../../teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import {} from '../dto/statistics-raw-results.dto';
import { toDateOnly } from '../utils/date.utils';

/**
 * Totais e distribuições da visão geral.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas. São as consultas que alimentam `/statistics/overview`: só
 * contagens e agregações, sem os filtros das listagens.
 */
@Injectable()
export class OverviewStatisticsRepository {
  constructor(
    @InjectRepository(PagelaEntity)
    private readonly pagelasRepository: Repository<PagelaEntity>,
    @InjectRepository(AcceptedChristEntity)
    private readonly acceptedChristsRepository: Repository<AcceptedChristEntity>,
    @InjectRepository(ChildEntity)
    private readonly childrenRepository: Repository<ChildEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubsRepository: Repository<ClubEntity>,
    @InjectRepository(TeacherProfileEntity)
    private readonly teachersRepository: Repository<TeacherProfileEntity>,
  ) {}

  async getTotalCounts() {
    const [
      totalChildren,
      totalClubs,
      totalTeachers,
      inactiveChildren,
      inactiveClubs,
    ] = await Promise.all([
      this.childrenRepository.count({ where: { isActive: true } }),
      this.clubsRepository.count({ where: { isActive: true } }),
      this.teachersRepository.count(),
      this.childrenRepository.count({ where: { isActive: false } }),
      this.clubsRepository.count({ where: { isActive: false } }),
    ]);

    return {
      totalChildren,
      totalClubs,
      totalTeachers,
      inactiveChildren,
      inactiveClubs,
    };
  }

  async getActiveCountsThisMonth() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [activeChildren, activeTeachers] = await Promise.all([
      this.pagelasRepository
        .createQueryBuilder('pagela')
        .leftJoin('pagela.child', 'child')
        .select('COUNT(DISTINCT pagela.child.id)', 'count')
        .where('pagela.createdAt >= :startOfMonth', { startOfMonth })
        .andWhere('child.isActive = :isActive', { isActive: true })
        .getRawOne<{ count: string }>()
        .then((result) => (result ? parseInt(result.count) : 0)),
      this.pagelasRepository
        .createQueryBuilder('pagela')
        .select('COUNT(DISTINCT pagela.teacher.id)', 'count')
        .where('pagela.createdAt >= :startOfMonth', { startOfMonth })
        .getRawOne<{ count: string }>()
        .then((result) => (result ? parseInt(result.count) : 0)),
    ]);

    return {
      activeChildren,
      activeTeachers,
    };
  }

  async getClubsPerformanceMetrics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = toDateOnly(startOfMonth);
    const todayStr = toDateOnly(now);

    const clubsWithLowAttendance = await this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .andWhere('pagela.referenceDate >= :startDate', {
        startDate: startOfMonthStr,
      })
      .andWhere('pagela.referenceDate <= :endDate', { endDate: todayStr })
      .select('club.id', 'clubId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presentCount',
      )
      .groupBy('club.id')
      .having(
        '(SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END) / COUNT(pagela.id)) * 100 < 70',
      )
      .getRawMany<{
        clubId: string;
        totalPagelas: string;
        presentCount: string;
      }>();

    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
    const currentWeek = Math.ceil(
      (pastDaysOfYear + startOfYear.getDay() + 1) / 7,
    );

    const clubsWithPagelasThisWeek = await this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .andWhere('pagela.year = :year', { year: currentYear })
      .andWhere('pagela.week = :week', { week: currentWeek })
      .select('DISTINCT club.id', 'clubId')
      .getRawMany<{ clubId: string }>();

    const totalActiveClubs = await this.clubsRepository
      .createQueryBuilder('club')
      .where('club.isActive = :isActive', { isActive: true })
      .getCount();

    const clubsMissingPagelas =
      totalActiveClubs - clubsWithPagelasThisWeek.length;

    return {
      clubsWithLowAttendance: clubsWithLowAttendance.length,
      clubsMissingPagelas,
    };
  }

  async getChildrenEngagementMetrics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = toDateOnly(startOfMonth);
    const todayStr = toDateOnly(now);

    const childrenStats = await this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .andWhere('pagela.referenceDate >= :startDate', {
        startDate: startOfMonthStr,
      })
      .andWhere('pagela.referenceDate <= :endDate', { endDate: todayStr })
      .select('child.id', 'childId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presentCount',
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
      .getRawMany<{
        childId: string;
        totalPagelas: string;
        presentCount: string;
        meditationCount: string;
        verseCount: string;
      }>();

    let totalEngagement = 0;
    let childrenWithLowEngagement = 0;

    childrenStats.forEach((child) => {
      const total = parseInt(child.totalPagelas);
      const present = parseInt(child.presentCount);
      const meditation = parseInt(child.meditationCount);
      const verse = parseInt(child.verseCount);

      const engagementScore =
        total > 0
          ? ((present * 0.3 + meditation * 0.35 + verse * 0.35) / total) * 100
          : 0;

      totalEngagement += engagementScore;
      if (engagementScore < 50) {
        childrenWithLowEngagement++;
      }
    });

    const avgEngagementScore =
      childrenStats.length > 0
        ? Math.round((totalEngagement / childrenStats.length) * 10) / 10
        : 0;

    return {
      avgEngagementScore,
      childrenWithLowEngagement,
    };
  }

  async getChildrenGenderDistribution() {
    const result = await this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('child.gender', 'gender')
      .addSelect('COUNT(child.id)', 'count')
      .groupBy('child.gender')
      .getRawMany<{ gender: string; count: string }>();

    const distribution = { M: 0, F: 0 };
    result.forEach((row) => {
      if (row.gender === 'M') distribution.M = parseInt(row.count);
      if (row.gender === 'F') distribution.F = parseInt(row.count);
    });

    return distribution;
  }

  async getGeographicDistribution() {
    const byState = await this.clubsRepository
      .createQueryBuilder('club')
      .leftJoin('club.address', 'address')
      .where('club.isActive = :isActive', { isActive: true })
      .select('address.state', 'state')
      .addSelect('COUNT(club.id)', 'count')
      .groupBy('address.state')
      .orderBy('count', 'DESC')
      .getRawMany<{ state: string; count: string }>();

    const topCities = await this.clubsRepository
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.address', 'address')
      .leftJoin('club.children', 'child')
      .where('club.isActive = :isActive', { isActive: true })
      .andWhere('child.isActive = :childActive', { childActive: true })
      .select('address.city', 'city')
      .addSelect('address.state', 'state')
      .addSelect('COUNT(DISTINCT club.id)', 'totalClubs')
      .addSelect('COUNT(DISTINCT child.id)', 'totalChildren')
      .groupBy('address.city')
      .addGroupBy('address.state')
      .orderBy('totalChildren', 'DESC')
      .getRawMany<{
        city: string;
        state: string;
        totalClubs: string;
        totalChildren: string;
      }>();

    return {
      byState: byState.map((row) => ({
        state: row.state,
        count: parseInt(row.count),
      })),
      topCities: topCities.map((row) => ({
        city: row.city,
        state: row.state,
        totalChildren: parseInt(row.totalChildren),
        totalClubs: parseInt(row.totalClubs),
      })),
    };
  }

  async getChildrenCountAt(date: string): Promise<number> {
    const count = await this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .andWhere('(child.joinedAt IS NULL OR child.joinedAt <= :date)', { date })
      .getCount();

    return count;
  }

  async getAcceptedChristsCountBefore(date: string): Promise<number> {
    const count = await this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .andWhere('ac.createdAt < :date', { date })
      .getCount();

    return count;
  }

  async getAcceptedChristsCountBetween(
    startDate: string,
    endDateExclusive: string,
  ): Promise<number> {
    return this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :childActive', { childActive: true })
      .andWhere('ac.createdAt >= :startDate', { startDate })
      .andWhere('ac.createdAt < :endDateExclusive', { endDateExclusive })
      .getCount();
  }
}
