import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PagelaEntity } from '../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../accepted-christs/entities/accepted-christ.entity';
import { ChildEntity } from '../children/entities/child.entity';
import { ClubEntity } from '../clubs/entities/club.entity/club.entity';
import { TeacherProfileEntity } from '../teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { ClubPeriodEntity } from '../club-control/entities/club-period.entity';
import { ClubExceptionEntity } from '../club-control/entities/club-exception.entity';
import { PagelasStatsQueryDto } from './dto/pagelas-stats-query.dto';
import { AcceptedChristsStatsQueryDto } from './dto/accepted-christs-stats-query.dto';
import { ChildrenStatsQueryDto } from './dto/children-stats-query.dto';
import { ClubsStatsQueryDto } from './dto/clubs-stats-query.dto';
import { TeachersStatsQueryDto } from './dto/teachers-stats-query.dto';
import { getAcademicWeekYear } from '../pagelas/week.util';

@Injectable()
export class StatisticsRepository {
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
    @InjectRepository(ClubPeriodEntity)
    private readonly periodsRepository: Repository<ClubPeriodEntity>,
    @InjectRepository(ClubExceptionEntity)
    private readonly exceptionsRepository: Repository<ClubExceptionEntity>,
  ) {}

  // ============= HELPER METHODS FOR FILTERS =============

  private applyPagelasFilters(
    query: SelectQueryBuilder<PagelaEntity>,
    filters: PagelasStatsQueryDto,
  ): void {
    // Time filters
    if (filters.year) {
      query.andWhere('pagela.year = :year', { year: filters.year });
    }
    if (filters.week) {
      query.andWhere('pagela.week = :week', { week: filters.week });
    }
    if (filters.startDate) {
      query.andWhere('pagela.referenceDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('pagela.referenceDate <= :endDate', { endDate: filters.endDate });
    }

    // Entity filters
    if (filters.clubId) {
      query.andWhere('child.club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.teacherId) {
      query.andWhere('pagela.teacher.id = :teacherId', { teacherId: filters.teacherId });
    }
    if (filters.coordinatorId) {
      query.andWhere('club.coordinator.id = :coordinatorId', { coordinatorId: filters.coordinatorId });
    }

    // Child demographic filters
    if (filters.gender) {
      query.andWhere('child.gender = :gender', { gender: filters.gender });
    }
    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const today = new Date();
      if (filters.maxAge !== undefined) {
        const minBirthDate = new Date(today.getFullYear() - filters.maxAge - 1, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate >= :minBirthDate', { 
          minBirthDate: minBirthDate.toISOString().split('T')[0] 
        });
      }
      if (filters.minAge !== undefined) {
        const maxBirthDate = new Date(today.getFullYear() - filters.minAge, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate <= :maxBirthDate', { 
          maxBirthDate: maxBirthDate.toISOString().split('T')[0] 
        });
      }
    }

    // Geographic filters
    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }
    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }
    if (filters.district) {
      query.andWhere('address.district = :district', { district: filters.district });
    }

    // Participation time filters
    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', { joinedAfter: filters.joinedAfter });
    }
    if (filters.joinedBefore) {
      query.andWhere('child.joinedAt <= :joinedBefore', { joinedBefore: filters.joinedBefore });
    }

    // Activity filters
    if (filters.onlyPresent) {
      query.andWhere('pagela.present = :present', { present: true });
    }
    if (filters.onlyDidMeditation) {
      query.andWhere('pagela.didMeditation = :didMeditation', { didMeditation: true });
    }
    if (filters.onlyRecitedVerse) {
      query.andWhere('pagela.recitedVerse = :recitedVerse', { recitedVerse: true });
    }
  }

  private applyAcceptedChristsFilters(
    query: SelectQueryBuilder<AcceptedChristEntity>,
    filters: AcceptedChristsStatsQueryDto,
  ): void {
    // Time filters
    if (filters.startDate) {
      query.andWhere('ac.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('ac.createdAt <= :endDate', { endDate: filters.endDate });
    }

    // Entity filters
    if (filters.clubId) {
      query.andWhere('child.club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.coordinatorId) {
      query.andWhere('club.coordinator.id = :coordinatorId', { coordinatorId: filters.coordinatorId });
    }

    // Decision filter
    if (filters.decision) {
      query.andWhere('ac.decision = :decision', { decision: filters.decision });
    }

    // Child demographic filters
    if (filters.gender) {
      query.andWhere('child.gender = :gender', { gender: filters.gender });
    }
    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const today = new Date();
      if (filters.maxAge !== undefined) {
        const minBirthDate = new Date(today.getFullYear() - filters.maxAge - 1, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate >= :minBirthDate', { 
          minBirthDate: minBirthDate.toISOString().split('T')[0] 
        });
      }
      if (filters.minAge !== undefined) {
        const maxBirthDate = new Date(today.getFullYear() - filters.minAge, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate <= :maxBirthDate', { 
          maxBirthDate: maxBirthDate.toISOString().split('T')[0] 
        });
      }
    }

    // Geographic filters
    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }
    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }
    if (filters.district) {
      query.andWhere('address.district = :district', { district: filters.district });
    }

    // Participation time filters
    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', { joinedAfter: filters.joinedAfter });
    }
    if (filters.joinedBefore) {
      query.andWhere('child.joinedAt <= :joinedBefore', { joinedBefore: filters.joinedBefore });
    }
  }

  private getDateGroupFormat(groupBy: 'day' | 'week' | 'month' | 'year'): { format: string; groupBy: string } {
    switch (groupBy) {
      case 'day':
        return {
          format: 'DATE(pagela.referenceDate)',
          groupBy: 'DATE(pagela.referenceDate)',
        };
      case 'week':
        return {
          format: "CONCAT(pagela.year, '-W', LPAD(pagela.week, 2, '0'))",
          groupBy: 'pagela.year, pagela.week',
        };
      case 'year':
        return {
          format: 'pagela.year',
          groupBy: 'pagela.year',
        };
      case 'month':
      default:
        return {
          format: "DATE_FORMAT(pagela.referenceDate, '%Y-%m')",
          groupBy: "DATE_FORMAT(pagela.referenceDate, '%Y-%m')",
        };
    }
  }

  private calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  private getAgeGroup(age: number): string {
    if (age <= 5) return '0-5';
    if (age <= 10) return '6-10';
    if (age <= 15) return '11-15';
    return '16+';
  }

  private calculateMonthsParticipating(joinedAt: string | null | undefined): number {
    if (!joinedAt) return 0;
    const joined = new Date(joinedAt);
    const today = new Date();
    const months = (today.getFullYear() - joined.getFullYear()) * 12 + (today.getMonth() - joined.getMonth());
    return Math.max(0, months);
  }

  private getParticipationTimeRange(months: number): string {
    if (months < 3) return '0-3 meses';
    if (months < 6) return '3-6 meses';
    if (months < 12) return '6-12 meses';
    return '1+ ano';
  }

  // ============= PAGELAS BASIC STATISTICS =============

  async getPagelasWeeklyStats(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('pagela.teacher', 'teacher')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('pagela.year', 'year')
      .addSelect('pagela.week', 'week')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presentCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'didMeditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'recitedVerseCount')
      .addSelect('COUNT(DISTINCT pagela.child.id)', 'uniqueChildren')
      .addSelect('COUNT(DISTINCT pagela.teacher.id)', 'uniqueTeachers')
      .groupBy('pagela.year')
      .addGroupBy('pagela.week')
      .orderBy('pagela.year', 'DESC')
      .addOrderBy('pagela.week', 'DESC');

    this.applyPagelasFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => ({
      year: parseInt(row.year),
      week: parseInt(row.week),
      totalPagelas: parseInt(row.totalPagelas),
      presentCount: parseInt(row.presentCount),
      didMeditationCount: parseInt(row.didMeditationCount),
      recitedVerseCount: parseInt(row.recitedVerseCount),
      uniqueChildren: parseInt(row.uniqueChildren),
      uniqueTeachers: parseInt(row.uniqueTeachers),
      presenceRate: row.totalPagelas > 0 ? (row.presentCount / row.totalPagelas) * 100 : 0,
      meditationRate: row.totalPagelas > 0 ? (row.didMeditationCount / row.totalPagelas) * 100 : 0,
      verseRecitationRate: row.totalPagelas > 0 ? (row.recitedVerseCount / row.totalPagelas) * 100 : 0,
    }));
  }

  async getPagelasOverallStats(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('pagela.teacher', 'teacher')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('COUNT(DISTINCT pagela.child.id)', 'totalChildren')
      .addSelect('COUNT(DISTINCT pagela.teacher.id)', 'totalTeachers')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presentCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'didMeditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'recitedVerseCount');

    this.applyPagelasFilters(query, filters);

    const result = await query.getRawOne();

    const totalPagelas = parseInt(result.totalPagelas) || 0;

    return {
      totalPagelas,
      totalChildren: parseInt(result.totalChildren) || 0,
      totalTeachers: parseInt(result.totalTeachers) || 0,
      averagePresenceRate: totalPagelas > 0 ? (result.presentCount / totalPagelas) * 100 : 0,
      averageMeditationRate: totalPagelas > 0 ? (result.didMeditationCount / totalPagelas) * 100 : 0,
      averageVerseRecitationRate: totalPagelas > 0 ? (result.recitedVerseCount / totalPagelas) * 100 : 0,
    };
  }

  async getPagelasTopPerformers(filters: PagelasStatsQueryDto, limit: number = 10) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('child.id', 'childId')
      .addSelect('child.name', 'childName')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presenceCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseRecitationCount')
      .groupBy('child.id')
      .addGroupBy('child.name')
      .orderBy('presenceCount', 'DESC')
      .addOrderBy('meditationCount', 'DESC')
      .limit(limit);

    this.applyPagelasFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => ({
      childId: row.childId,
      childName: row.childName,
      presenceCount: parseInt(row.presenceCount),
      meditationCount: parseInt(row.meditationCount),
      verseRecitationCount: parseInt(row.verseRecitationCount),
    }));
  }

  // ============= PAGELAS CHART DATA =============

  async getPagelasByGender(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('child.gender', 'gender')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presentCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseCount')
      .groupBy('child.gender');

    this.applyPagelasFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => {
      const total = parseInt(row.total);
      return {
        gender: row.gender,
        total,
        presenceRate: total > 0 ? (parseInt(row.presentCount) / total) * 100 : 0,
        meditationRate: total > 0 ? (parseInt(row.meditationCount) / total) * 100 : 0,
        verseRecitationRate: total > 0 ? (parseInt(row.verseCount) / total) * 100 : 0,
      };
    });
  }

  async getPagelasByAgeGroup(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoinAndSelect('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true });

    this.applyPagelasFilters(query, filters);

    const pagelas = await query.getMany();

    // Group by age
    const ageGroups = new Map<string, any>();

    pagelas.forEach((pagela) => {
      const age = this.calculateAge(pagela.child.birthDate);
      const ageGroup = this.getAgeGroup(age);

      if (!ageGroups.has(ageGroup)) {
        ageGroups.set(ageGroup, {
          ageGroup,
          total: 0,
          presentCount: 0,
          meditationCount: 0,
          verseCount: 0,
        });
      }

      const group = ageGroups.get(ageGroup);
      group.total++;
      if (pagela.present) group.presentCount++;
      if (pagela.didMeditation) group.meditationCount++;
      if (pagela.recitedVerse) group.verseCount++;
    });

    return Array.from(ageGroups.values()).map((group) => ({
      ageGroup: group.ageGroup,
      total: group.total,
      presenceRate: group.total > 0 ? (group.presentCount / group.total) * 100 : 0,
      meditationRate: group.total > 0 ? (group.meditationCount / group.total) * 100 : 0,
      verseRecitationRate: group.total > 0 ? (group.verseCount / group.total) * 100 : 0,
    }));
  }

  async getPagelasByClub(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.id IS NOT NULL')
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('club.id', 'clubId')
      .addSelect('club.number', 'clubNumber')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presentCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseCount')
      .groupBy('club.id')
      .addGroupBy('club.number')
      .orderBy('clubNumber', 'ASC');

    this.applyPagelasFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => {
      const total = parseInt(row.total);
      return {
        clubId: row.clubId,
        clubNumber: parseInt(row.clubNumber),
        total,
        uniqueChildren: parseInt(row.uniqueChildren),
        presenceRate: total > 0 ? (parseInt(row.presentCount) / total) * 100 : 0,
        meditationRate: total > 0 ? (parseInt(row.meditationCount) / total) * 100 : 0,
        verseRecitationRate: total > 0 ? (parseInt(row.verseCount) / total) * 100 : 0,
      };
    });
  }

  async getPagelasByTeacher(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.teacher', 'teacher')
      .leftJoin('teacher.user', 'user')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('teacher.id IS NOT NULL')
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('teacher.id', 'teacherId')
      .addSelect('user.name', 'teacherName')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presentCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseCount')
      .groupBy('teacher.id')
      .addGroupBy('user.name')
      .orderBy('total', 'DESC');

    this.applyPagelasFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => {
      const total = parseInt(row.total);
      return {
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        total,
        uniqueChildren: parseInt(row.uniqueChildren),
        presenceRate: total > 0 ? (parseInt(row.presentCount) / total) * 100 : 0,
        meditationRate: total > 0 ? (parseInt(row.meditationCount) / total) * 100 : 0,
        verseRecitationRate: total > 0 ? (parseInt(row.verseCount) / total) * 100 : 0,
      };
    });
  }

  async getPagelasTimeSeries(filters: PagelasStatsQueryDto) {
    const groupBy = filters.groupBy || 'week';
    const dateFormat = this.getDateGroupFormat(groupBy);

    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .select(`${dateFormat.format}`, 'period')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'present')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditation')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verse')
      .groupBy(dateFormat.groupBy)
      .orderBy('period', 'ASC');

    this.applyPagelasFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => ({
      date: row.period,
      total: parseInt(row.total),
      present: parseInt(row.present),
      meditation: parseInt(row.meditation),
      verse: parseInt(row.verse),
    }));
  }

  async getPagelasByCity(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('address.city IS NOT NULL')
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('address.city', 'city')
      .addSelect('address.state', 'state')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presentCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseCount')
      .groupBy('address.city')
      .addGroupBy('address.state')
      .orderBy('total', 'DESC');

    this.applyPagelasFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => {
      const total = parseInt(row.total);
      return {
        city: row.city,
        state: row.state,
        total,
        uniqueChildren: parseInt(row.uniqueChildren),
        presenceRate: total > 0 ? (parseInt(row.presentCount) / total) * 100 : 0,
        meditationRate: total > 0 ? (parseInt(row.meditationCount) / total) * 100 : 0,
        verseRecitationRate: total > 0 ? (parseInt(row.verseCount) / total) * 100 : 0,
      };
    });
  }

  async getPagelasByParticipationTime(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoinAndSelect('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true });

    this.applyPagelasFilters(query, filters);

    const pagelas = await query.getMany();

    // Group by participation time
    const timeGroups = new Map<string, any>();

    pagelas.forEach((pagela) => {
      const months = this.calculateMonthsParticipating(pagela.child.joinedAt);
      const timeRange = this.getParticipationTimeRange(months);

      if (!timeGroups.has(timeRange)) {
        timeGroups.set(timeRange, {
          timeRange,
          total: 0,
          presentCount: 0,
          meditationCount: 0,
          verseCount: 0,
          childrenMonths: [],
        });
      }

      const group = timeGroups.get(timeRange);
      group.total++;
      if (pagela.present) group.presentCount++;
      if (pagela.didMeditation) group.meditationCount++;
      if (pagela.recitedVerse) group.verseCount++;
      group.childrenMonths.push(months);
    });

    // Count unique children per time range
    const uniqueChildrenByRange = new Map<string, Set<string>>();
    pagelas.forEach((pagela) => {
      const months = this.calculateMonthsParticipating(pagela.child.joinedAt);
      const timeRange = this.getParticipationTimeRange(months);
      if (!uniqueChildrenByRange.has(timeRange)) {
        uniqueChildrenByRange.set(timeRange, new Set());
      }
      uniqueChildrenByRange.get(timeRange)!.add(pagela.child.id);
    });

    const orderedRanges = ['0-3 meses', '3-6 meses', '6-12 meses', '1+ ano'];
    
    return orderedRanges
      .filter((range) => timeGroups.has(range))
      .map((range) => {
        const group = timeGroups.get(range);
        const avgMonths = group.childrenMonths.length > 0
          ? group.childrenMonths.reduce((a: number, b: number) => a + b, 0) / group.childrenMonths.length
          : 0;

        return {
          timeRange: group.timeRange,
          total: group.total,
          uniqueChildren: uniqueChildrenByRange.get(range)?.size || 0,
          presenceRate: group.total > 0 ? (group.presentCount / group.total) * 100 : 0,
          meditationRate: group.total > 0 ? (group.meditationCount / group.total) * 100 : 0,
          verseRecitationRate: group.total > 0 ? (group.verseCount / group.total) * 100 : 0,
          avgMonthsParticipating: Math.round(avgMonths * 10) / 10,
        };
      });
  }

  // ============= ACCEPTED CHRISTS STATISTICS =============

  async getAcceptedChristsOverallStats(filters: AcceptedChristsStatsQueryDto) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('COUNT(ac.id)', 'totalDecisions')
      .addSelect('COUNT(DISTINCT ac.child.id)', 'uniqueChildren')
      .addSelect('ac.decision', 'decision');

    this.applyAcceptedChristsFilters(query, filters);

    query.groupBy('ac.decision');

    const results = await query.getRawMany();

    const byDecisionType: { [key: string]: number } = {};
    let totalDecisions = 0;

    results.forEach((row) => {
      const count = parseInt(row.totalDecisions);
      totalDecisions += count;
      if (row.decision) {
        byDecisionType[row.decision] = count;
      }
    });

    // Get unique children count across all decision types
    const uniqueQuery = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true })
      .select('COUNT(DISTINCT ac.child.id)', 'uniqueChildren');

    this.applyAcceptedChristsFilters(uniqueQuery, filters);

    const uniqueResult = await uniqueQuery.getRawOne();

    return {
      totalDecisions,
      uniqueChildren: parseInt(uniqueResult.uniqueChildren) || 0,
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
        dateFormat = "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
        groupByClause = "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
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
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select(`${dateFormat}`, 'period')
      .addSelect('COUNT(ac.id)', 'totalDecisions')
      .addSelect('COUNT(DISTINCT ac.child.id)', 'uniqueChildren')
      .addSelect('ac.decision', 'decision')
      .groupBy(groupByClause)
      .addGroupBy('ac.decision')
      .orderBy('period', 'DESC');

    this.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany();

    // Group by period
    const periodMap = new Map<string, any>();

    results.forEach((row) => {
      const period = row.period;
      if (!periodMap.has(period)) {
        periodMap.set(period, {
          period,
          totalDecisions: 0,
          byDecisionType: {},
          uniqueChildren: parseInt(row.uniqueChildren),
        });
      }

      const periodData = periodMap.get(period);
      const count = parseInt(row.totalDecisions);
      periodData.totalDecisions += count;
      
      if (row.decision) {
        periodData.byDecisionType[row.decision] = (periodData.byDecisionType[row.decision] || 0) + count;
      }
    });

    return Array.from(periodMap.values());
  }

  async getRecentAcceptedChrists(filters: AcceptedChristsStatsQueryDto, limit: number = 10) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .orderBy('ac.createdAt', 'DESC')
      .limit(limit);

    this.applyAcceptedChristsFilters(query, filters);

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

  // ============= ACCEPTED CHRISTS CHART DATA =============

  async getAcceptedChristsByGender(filters: AcceptedChristsStatsQueryDto) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('child.gender', 'gender')
      .addSelect('COUNT(ac.id)', 'total')
      .addSelect('SUM(CASE WHEN ac.decision = "ACCEPTED" THEN 1 ELSE 0 END)', 'accepted')
      .addSelect('SUM(CASE WHEN ac.decision = "RECONCILED" THEN 1 ELSE 0 END)', 'reconciled')
      .groupBy('child.gender');

    this.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany();

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
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true });

    this.applyAcceptedChristsFilters(query, filters);

    const decisions = await query.getMany();

    // Group by age
    const ageGroups = new Map<string, any>();

    decisions.forEach((ac) => {
      const age = this.calculateAge(ac.child.birthDate);
      const ageGroup = this.getAgeGroup(age);

      if (!ageGroups.has(ageGroup)) {
        ageGroups.set(ageGroup, {
          ageGroup,
          total: 0,
          accepted: 0,
          reconciled: 0,
        });
      }

      const group = ageGroups.get(ageGroup);
      group.total++;
      if (ac.decision === 'ACCEPTED') group.accepted++;
      if (ac.decision === 'RECONCILED') group.reconciled++;
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
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('club.id', 'clubId')
      .addSelect('club.number', 'clubNumber')
      .addSelect('COUNT(ac.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect('SUM(CASE WHEN ac.decision = "ACCEPTED" THEN 1 ELSE 0 END)', 'accepted')
      .addSelect('SUM(CASE WHEN ac.decision = "RECONCILED" THEN 1 ELSE 0 END)', 'reconciled')
      .groupBy('club.id')
      .addGroupBy('club.number')
      .orderBy('clubNumber', 'ASC');

    this.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany();

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
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('address.city IS NOT NULL')
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('address.city', 'city')
      .addSelect('address.state', 'state')
      .addSelect('COUNT(ac.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect('SUM(CASE WHEN ac.decision = "ACCEPTED" THEN 1 ELSE 0 END)', 'accepted')
      .addSelect('SUM(CASE WHEN ac.decision = "RECONCILED" THEN 1 ELSE 0 END)', 'reconciled')
      .groupBy('address.city')
      .addGroupBy('address.state')
      .orderBy('total', 'DESC');

    this.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => ({
      city: row.city,
      state: row.state,
      total: parseInt(row.total),
      uniqueChildren: parseInt(row.uniqueChildren),
      accepted: parseInt(row.accepted),
      reconciled: parseInt(row.reconciled),
    }));
  }

  async getAcceptedChristsByParticipationTime(filters: AcceptedChristsStatsQueryDto) {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true });

    this.applyAcceptedChristsFilters(query, filters);

    const decisions = await query.getMany();

    // Group by participation time
    const timeGroups = new Map<string, any>();

    decisions.forEach((ac) => {
      const months = this.calculateMonthsParticipating(ac.child.joinedAt);
      const timeRange = this.getParticipationTimeRange(months);

      if (!timeGroups.has(timeRange)) {
        timeGroups.set(timeRange, {
          timeRange,
          total: 0,
          accepted: 0,
          reconciled: 0,
          childrenMonths: [],
        });
      }

      const group = timeGroups.get(timeRange);
      group.total++;
      if (ac.decision === 'ACCEPTED') group.accepted++;
      if (ac.decision === 'RECONCILED') group.reconciled++;
      group.childrenMonths.push(months);
    });

    // Count unique children per time range
    const uniqueChildrenByRange = new Map<string, Set<string>>();
    decisions.forEach((ac) => {
      const months = this.calculateMonthsParticipating(ac.child.joinedAt);
      const timeRange = this.getParticipationTimeRange(months);
      if (!uniqueChildrenByRange.has(timeRange)) {
        uniqueChildrenByRange.set(timeRange, new Set());
      }
      uniqueChildrenByRange.get(timeRange)!.add(ac.child.id);
    });

    const orderedRanges = ['0-3 meses', '3-6 meses', '6-12 meses', '1+ ano'];
    
    return orderedRanges
      .filter((range) => timeGroups.has(range))
      .map((range) => {
        const group = timeGroups.get(range);
        const avgMonths = group.childrenMonths.length > 0
          ? group.childrenMonths.reduce((a: number, b: number) => a + b, 0) / group.childrenMonths.length
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
        dateFormat = "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
        groupByClause = "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
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
      .where('club.isActive = :clubActive', { clubActive: true })
      .select(`${dateFormat}`, 'period')
      .addSelect('COUNT(ac.id)', 'total')
      .addSelect('SUM(CASE WHEN ac.decision = "ACCEPTED" THEN 1 ELSE 0 END)', 'accepted')
      .addSelect('SUM(CASE WHEN ac.decision = "RECONCILED" THEN 1 ELSE 0 END)', 'reconciled')
      .groupBy(groupByClause)
      .orderBy('period', 'ASC');

    this.applyAcceptedChristsFilters(query, filters);

    const results = await query.getRawMany();

    return results.map((row) => ({
      date: row.period,
      total: parseInt(row.total),
      accepted: parseInt(row.accepted),
      reconciled: parseInt(row.reconciled),
    }));
  }

  // ============= OVERVIEW STATISTICS =============

  async getTotalCounts() {
    const [totalChildren, totalClubs, totalTeachers] = await Promise.all([
      this.childrenRepository.count(),
      this.clubsRepository.count({ where: { isActive: true } }),
      this.teachersRepository.count(),
    ]);

    return {
      totalChildren,
      totalClubs,
      totalTeachers,
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
        .getRawOne()
        .then((result) => parseInt(result.count) || 0),
      this.pagelasRepository
        .createQueryBuilder('pagela')
        .select('COUNT(DISTINCT pagela.teacher.id)', 'count')
        .where('pagela.createdAt >= :startOfMonth', { startOfMonth })
        .getRawOne()
        .then((result) => parseInt(result.count) || 0),
    ]);

    return {
      activeChildren,
      activeTeachers,
    };
  }

  // ============= COMBINED INSIGHTS =============

  async getTopEngagedChildren(filters: PagelasStatsQueryDto, limit: number = 20) {
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
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presenceCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseCount')
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

    this.applyPagelasFilters(query, filters);

    const results = await query.getRawMany();

    // Get decisions for these children
    const childIds = results.map((r) => r.childId);
    const decisions = childIds.length > 0
      ? await this.acceptedChristsRepository
          .createQueryBuilder('ac')
          .leftJoinAndSelect('ac.child', 'child')
          .where('child.id IN (:...childIds)', { childIds })
          .getMany()
      : [];

    const decisionsMap = new Map();
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
      const age = this.calculateAge(row.birthDate);

      // Engagement score: weighted average of activities
      const engagementScore =
        totalPagelas > 0
          ? ((presenceCount * 0.3 + meditationCount * 0.35 + verseCount * 0.35) / totalPagelas) * 100
          : 0;

      const monthsParticipating = this.calculateMonthsParticipating(row.joinedAt);

      return {
        childId: row.childId,
        childName: row.childName,
        gender: row.gender,
        age,
        clubNumber: row.clubNumber ? parseInt(row.clubNumber) : null,
        city: row.city || null,
        state: row.state || null,
        monthsParticipating,
        engagementScore: Math.round(engagementScore * 10) / 10,
        totalPagelas,
        presenceRate: totalPagelas > 0 ? (presenceCount / totalPagelas) * 100 : 0,
        hasDecision: decisionsMap.has(row.childId),
        decisionType: decisionsMap.get(row.childId) || null,
      };
    });
  }

  async getClubRankings(filters: PagelasStatsQueryDto) {
    // Get all clubs with their stats (apenas de crianças ATIVAS)
    const pagelasQuery = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.id IS NOT NULL')
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('club.id', 'clubId')
      .addSelect('club.number', 'clubNumber')
      .addSelect('COUNT(DISTINCT child.id)', 'activeChildren')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presenceCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .groupBy('club.id')
      .addGroupBy('club.number');

    this.applyPagelasFilters(pagelasQuery, filters);

    const pagelasResults = await pagelasQuery.getRawMany();

    // Get club children counts
    const clubIds = pagelasResults.map((r) => r.clubId);
    const childrenCounts = clubIds.length > 0
      ? await this.childrenRepository
          .createQueryBuilder('child')
          .select('child.club.id', 'clubId')
          .addSelect('COUNT(child.id)', 'totalChildren')
          .leftJoin('child.club', 'club')
          .where('child.club.id IN (:...clubIds)', { clubIds })
          .andWhere('club.isActive = :clubActive', { clubActive: true })
          .andWhere('child.isActive = :isActive', { isActive: true })
          .groupBy('child.club.id')
          .getRawMany()
      : [];

    const childrenMap = new Map(
      childrenCounts.map((c) => [c.clubId, parseInt(c.totalChildren)]),
    );

    // Get decision counts by club (apenas de crianças ATIVAS)
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

    const decisionsResults = clubIds.length > 0 ? await decisionsQuery.getRawMany() : [];
    const decisionsMap = new Map(
      decisionsResults.map((d) => [d.clubId, parseInt(d.totalDecisions)]),
    );

    return pagelasResults.map((row) => {
      const totalPagelas = parseInt(row.totalPagelas);
      const presenceCount = parseInt(row.presenceCount);
      const meditationCount = parseInt(row.meditationCount);
      const totalChildren = childrenMap.get(row.clubId) || 0;
      const activeChildren = parseInt(row.activeChildren);
      const totalDecisions = decisionsMap.get(row.clubId) || 0;

      const avgPresenceRate = totalPagelas > 0 ? (presenceCount / totalPagelas) * 100 : 0;
      const avgMeditationRate = totalPagelas > 0 ? (meditationCount / totalPagelas) * 100 : 0;
      const activityRate = totalChildren > 0 ? (activeChildren / totalChildren) * 100 : 0;
      const decisionRate = activeChildren > 0 ? (totalDecisions / activeChildren) * 100 : 0;

      // Performance score: weighted average
      const performanceScore =
        avgPresenceRate * 0.3 +
        avgMeditationRate * 0.3 +
        activityRate * 0.2 +
        decisionRate * 0.2;

      return {
        clubId: row.clubId,
        clubNumber: parseInt(row.clubNumber),
        totalChildren,
        activeChildren,
        avgPresenceRate: Math.round(avgPresenceRate * 10) / 10,
        avgMeditationRate: Math.round(avgMeditationRate * 10) / 10,
        totalDecisions,
        performanceScore: Math.round(performanceScore * 10) / 10,
      };
      }).sort((a, b) => b.performanceScore - a.performanceScore);
  }

  // ============= CHILDREN VIEW STATISTICS =============

  async getChildrenWithStats(filters: ChildrenStatsQueryDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Build base query
    const query = this.childrenRepository
      .createQueryBuilder('child')
      .leftJoinAndSelect('child.club', 'club')
      .leftJoinAndSelect('child.address', 'address')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true });

    // ✅ SEMPRE filtrar apenas crianças ATIVAS
    query.andWhere('child.isActive = :isActive', { isActive: true });

    // Apply filters
    if (filters.clubId) {
      query.andWhere('club.id = :clubId', { clubId: filters.clubId });
    }

    if (filters.coordinatorId) {
      query.andWhere('coordinator.id = :coordinatorId', { coordinatorId: filters.coordinatorId });
    }

    if (filters.gender) {
      query.andWhere('child.gender = :gender', { gender: filters.gender });
    }

    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const today = new Date();
      if (filters.maxAge !== undefined) {
        const minBirthDate = new Date(today.getFullYear() - filters.maxAge - 1, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate >= :minBirthDate', { 
          minBirthDate: minBirthDate.toISOString().split('T')[0] 
        });
      }
      if (filters.minAge !== undefined) {
        const maxBirthDate = new Date(today.getFullYear() - filters.minAge, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate <= :maxBirthDate', { 
          maxBirthDate: maxBirthDate.toISOString().split('T')[0] 
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
      query.andWhere('address.district = :district', { district: filters.district });
    }

    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', { joinedAfter: filters.joinedAfter });
    }

    if (filters.joinedBefore) {
      query.andWhere('child.joinedAt <= :joinedBefore', { joinedBefore: filters.joinedBefore });
    }

    // Get total count before pagination
    const totalCount = await query.getCount();

    // Apply sorting
    const sortBy = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'ASC';

    switch (sortBy) {
      case 'age':
        query.orderBy('child.birthDate', sortOrder === 'ASC' ? 'DESC' : 'ASC'); // Inverted for age
        break;
      case 'name':
      default:
        query.orderBy('child.name', sortOrder);
        break;
    }

    // Apply pagination
    query.skip(skip).take(limit);

    const children = await query.getMany();

    // Get pagelas stats for these children
    const childIds = children.map((c) => c.id);
    
    let pagelasStats = new Map();
    if (childIds.length > 0) {
      const pagelasQuery = this.pagelasRepository
        .createQueryBuilder('pagela')
        .select('pagela.child.id', 'childId')
        .addSelect('COUNT(pagela.id)', 'totalPagelas')
        .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presenceCount')
        .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
        .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseCount')
        .addSelect('MAX(pagela.referenceDate)', 'lastPagelaDate')
        .where('pagela.child.id IN (:...childIds)', { childIds })
        .groupBy('pagela.child.id');

      // Apply time filters to pagelas
      if (filters.year) {
        pagelasQuery.andWhere('pagela.year = :year', { year: filters.year });
      }
      if (filters.startDate) {
        pagelasQuery.andWhere('pagela.referenceDate >= :startDate', { startDate: filters.startDate });
      }
      if (filters.endDate) {
        pagelasQuery.andWhere('pagela.referenceDate <= :endDate', { endDate: filters.endDate });
      }
      if (filters.teacherId) {
        pagelasQuery.andWhere('pagela.teacher.id = :teacherId', { teacherId: filters.teacherId });
      }

      const pagelasResults = await pagelasQuery.getRawMany();
      pagelasStats = new Map(pagelasResults.map((p) => [p.childId, p]));
    }

    // Get decisions for these children
    let decisionsMap = new Map();
    if (childIds.length > 0) {
      const decisions = await this.acceptedChristsRepository
        .createQueryBuilder('ac')
        .leftJoinAndSelect('ac.child', 'child')
        .select('child.id', 'childId')
        .addSelect('COUNT(ac.id)', 'totalDecisions')
        .addSelect('MAX(ac.decision)', 'lastDecision')
        .addSelect('MAX(ac.createdAt)', 'lastDecisionDate')
        .where('child.id IN (:...childIds)', { childIds })
        .groupBy('child.id');

      if (filters.decisionType) {
        decisions.andWhere('ac.decision = :decisionType', { decisionType: filters.decisionType });
      }

      const decisionsResults = await decisions.getRawMany();
      decisionsMap = new Map(decisionsResults.map((d) => [d.childId, d]));
    }

    // Filter by stats if needed
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
        const presenceRate = stats.totalPagelas > 0 
          ? (parseInt(stats.presenceCount) / parseInt(stats.totalPagelas)) * 100 
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
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      filteredChildren = filteredChildren.filter((child) => {
        const stats = pagelasStats.get(child.id);
        if (!stats || !stats.lastPagelaDate) return !filters.isActive;
        const isActive = stats.lastPagelaDate >= thirtyDaysAgoStr;
        return filters.isActive ? isActive : !isActive;
      });
    }

    if (filters.ageGroup) {
      filteredChildren = filteredChildren.filter((child) => {
        const age = this.calculateAge(child.birthDate);
        const ageGroup = this.getAgeGroup(age);
        return ageGroup === filters.ageGroup;
      });
    }

    return {
      children: filteredChildren,
      pagelasStats,
      decisionsMap,
      totalCount,
      filteredCount: filteredChildren.length,
      page,
      limit,
    };
  }

  async getChildrenStatsDistribution(filters: ChildrenStatsQueryDto) {
    // This will be used for the distribution charts
    const query = this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .leftJoin('child.address', 'address')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true });

    // ✅ SEMPRE filtrar apenas crianças ATIVAS
    query.andWhere('child.isActive = :isActive', { isActive: true });

    // Apply same filters as getChildrenWithStats
    if (filters.clubId) {
      query.andWhere('club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.coordinatorId) {
      query.andWhere('coordinator.id = :coordinatorId', { coordinatorId: filters.coordinatorId });
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
      query.andWhere('address.district = :district', { district: filters.district });
    }
    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', { joinedAfter: filters.joinedAfter });
    }
    if (filters.joinedBefore) {
      query.andWhere('child.joinedAt <= :joinedBefore', { joinedBefore: filters.joinedBefore });
    }

    const children = await query.getMany();

    // Calculate distributions
    const byGender = new Map<string, number>();
    const byAgeGroup = new Map<string, number>();
    const byClub = new Map<string, { id: string; number: number; count: number }>();
    const byCity = new Map<string, { state: string; count: number }>();
    const byParticipationTime = new Map<string, number>();

    children.forEach((child) => {
      // Gender
      byGender.set(child.gender, (byGender.get(child.gender) || 0) + 1);

      // Age Group
      const age = this.calculateAge(child.birthDate);
      const ageGroup = this.getAgeGroup(age);
      byAgeGroup.set(ageGroup, (byAgeGroup.get(ageGroup) || 0) + 1);

      // Club
      if (child.club) {
        const clubKey = child.club.id;
        if (!byClub.has(clubKey)) {
          byClub.set(clubKey, { id: child.club.id, number: child.club.number, count: 0 });
        }
        byClub.get(clubKey)!.count++;
      }

      // City
      if (child.address?.city) {
        const cityKey = child.address.city;
        if (!byCity.has(cityKey)) {
          byCity.set(cityKey, { state: child.address.state, count: 0 });
        }
        byCity.get(cityKey)!.count++;
      }

      // Participation Time
      const months = this.calculateMonthsParticipating(child.joinedAt);
      const timeRange = this.getParticipationTimeRange(months);
      byParticipationTime.set(timeRange, (byParticipationTime.get(timeRange) || 0) + 1);
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
      byParticipationTime: Array.from(byParticipationTime.entries()).map(([timeRange, count]) => ({
        timeRange,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      })),
    };
  }

  // ============= CLUBS VIEW STATISTICS =============

  async getClubsWithStats(filters: ClubsStatsQueryDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Build base query - apenas clubinhos ativos
    const query = this.clubsRepository
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.address', 'address')
      .leftJoinAndSelect('club.coordinator', 'coordinator')
      .leftJoin('coordinator.user', 'coordinatorUser')
      .where('club.isActive = :isActive', { isActive: true });

    // Apply filters
    if (filters.coordinatorId) {
      query.andWhere('coordinator.id = :coordinatorId', { coordinatorId: filters.coordinatorId });
    }

    if (filters.weekday) {
      query.andWhere('club.weekday = :weekday', { weekday: filters.weekday });
    }

    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }

    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }

    if (filters.district) {
      query.andWhere('address.district = :district', { district: filters.district });
    }

    // Get total count
    const totalCount = await query.getCount();

    // Apply sorting (will be refined later based on stats)
    query.orderBy('club.number', 'ASC');

    const clubs = await query.skip(skip).take(limit).getMany();

    // Get stats for each club
    const clubIds = clubs.map((c) => c.id);

    // Get children count by club (apenas ATIVAS)
    const childrenQuery = this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .select('child.club.id', 'clubId')
      .addSelect('COUNT(child.id)', 'total')
      .addSelect('child.gender', 'gender')
      .where('child.club.id IN (:...clubIds)', { clubIds })
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .groupBy('child.club.id')
      .addGroupBy('child.gender');

    const childrenResults = clubIds.length > 0 ? await childrenQuery.getRawMany() : [];

    // Get pagelas stats by club (apenas de crianças ATIVAS)
    const pagelasQuery = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .select('child.club.id', 'clubId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('COUNT(DISTINCT child.id)', 'activeChildren')
      .addSelect('COUNT(DISTINCT pagela.teacher.id)', 'activeTeachers')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presenceCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseCount')
      .addSelect('MAX(pagela.referenceDate)', 'lastActivity')
      .where('child.club.id IN (:...clubIds)', { clubIds })
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .groupBy('child.club.id');

    if (filters.year) {
      pagelasQuery.andWhere('pagela.year = :year', { year: filters.year });
    }
    if (filters.startDate) {
      pagelasQuery.andWhere('pagela.referenceDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      pagelasQuery.andWhere('pagela.referenceDate <= :endDate', { endDate: filters.endDate });
    }

    const pagelasResults = clubIds.length > 0 ? await pagelasQuery.getRawMany() : [];

    // Get decisions by club (apenas de crianças ATIVAS)
    const decisionsQuery = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .select('child.club.id', 'clubId')
      .addSelect('COUNT(ac.id)', 'totalDecisions')
      .addSelect('COUNT(DISTINCT child.id)', 'childrenWithDecisions')
      .where('child.club.id IN (:...clubIds)', { clubIds })
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .groupBy('child.club.id');

    const decisionsResults = clubIds.length > 0 ? await decisionsQuery.getRawMany() : [];

    // Get teachers by club
    const teachersQuery = this.teachersRepository
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .leftJoin('teacher.club', 'club')
      .where('club.id IN (:...clubIds)', { clubIds })
      .andWhere('club.isActive = :clubActive', { clubActive: true });

    const teachers = clubIds.length > 0 ? await teachersQuery.getMany() : [];

    return {
      clubs,
      childrenResults,
      pagelasResults,
      decisionsResults,
      teachers,
      totalCount,
      page,
      limit,
    };
  }

  // ============= TEACHERS VIEW STATISTICS =============

  async getTeachersWithStats(filters: TeachersStatsQueryDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Build base query
    const query = this.teachersRepository
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .leftJoinAndSelect('teacher.club', 'club')
      .leftJoin('club.address', 'address')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true });

    // Apply filters
    if (filters.clubId) {
      query.andWhere('club.id = :clubId', { clubId: filters.clubId });
    }

    if (filters.coordinatorId) {
      query.andWhere('coordinator.id = :coordinatorId', { coordinatorId: filters.coordinatorId });
    }

    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }

    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }

    // Get total count
    const totalCount = await query.getCount();

    // Apply sorting
    query.orderBy('user.name', 'ASC');

    const teachers = await query.skip(skip).take(limit).getMany();

    // Get stats for each teacher
    const teacherIds = teachers.map((t) => t.id);

    // Get pagelas stats by teacher
    const pagelasQuery = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .select('pagela.teacher.id', 'teacherId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presenceCount')
      .addSelect('SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)', 'meditationCount')
      .addSelect('SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)', 'verseCount')
      .addSelect('MAX(pagela.referenceDate)', 'lastActivity')
      .where('pagela.teacher.id IN (:...teacherIds)', { teacherIds })
      .groupBy('pagela.teacher.id');

    if (filters.year) {
      pagelasQuery.andWhere('pagela.year = :year', { year: filters.year });
    }
    if (filters.startDate) {
      pagelasQuery.andWhere('pagela.referenceDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      pagelasQuery.andWhere('pagela.referenceDate <= :endDate', { endDate: filters.endDate });
    }

    const pagelasResults = teacherIds.length > 0 ? await pagelasQuery.getRawMany() : [];

    // Get children with decisions taught by these teachers
    const decisionsQuery = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.pagelas', 'pagela')
      .select('pagela.teacher.id', 'teacherId')
      .addSelect('COUNT(DISTINCT child.id)', 'childrenWithDecisions')
      .where('pagela.teacher.id IN (:...teacherIds)', { teacherIds })
      .groupBy('pagela.teacher.id');

    const decisionsResults = teacherIds.length > 0 ? await decisionsQuery.getRawMany() : [];

    return {
      teachers,
      pagelasResults,
      decisionsResults,
      totalCount,
      page,
      limit,
    };
  }

  // ============= CLUB ATTENDANCE ANALYSIS =============

  /**
   * Analisa a frequência de um clube por semana
   * Detecta semanas faltantes baseado no dia da semana que o clube funciona
   */
  async analyzeClubAttendance(
    clubId: string,
    year: number,
    startDate?: string,
    endDate?: string,
    page?: number,
    limit?: number,
  ): Promise<any> {
    // Get club info
    const club = await this.clubsRepository.findOne({
      where: { id: clubId },
      relations: ['address'],
    });

    if (!club) {
      throw new Error('Clubinho not found');
    }

    // ✅ Buscar período letivo GLOBAL do ano
    const academicPeriod = await this.periodsRepository.findOne({
      where: { year, isActive: true },
    });

    // ⚠️ CRÍTICO: Se não há período letivo cadastrado, não gera estatísticas com alertas/indicadores
    // Se não há período, retorna análise neutra (sem semanas faltantes ou alertas negativos)
    const hasPeriod = !!academicPeriod;

    // Define period
    const periodStart = academicPeriod?.startDate || startDate || `${year}-01-01`;
    const periodEnd = academicPeriod?.endDate || endDate || `${year}-12-31`;

    // Buscar exceções GLOBAIS no período
    const exceptions = await this.exceptionsRepository
      .createQueryBuilder('exception')
      .where('exception.isActive = :isActive', { isActive: true })
      .andWhere('exception.exceptionDate >= :startDate', { startDate: periodStart })
      .andWhere('exception.exceptionDate <= :endDate', { endDate: periodEnd })
      .getMany();

    const exceptionDates = new Set(exceptions.map(e => e.exceptionDate));

    // ✅ Buscar todas as crianças ATIVAS do clube para calcular semanas esperadas
    const allChildren = await this.childrenRepository.find({
      where: { club: { id: clubId } },
    });

    // ✅ Filtrar apenas crianças ATIVAS
    const activeChildren = allChildren.filter(child => child.isActive === true);

    // ⚠️ IMPORTANTE: Buscar pagelas pelo período
    // As pagelas são armazenadas com semana do ano letivo (year e week)
    // year = ano do período letivo, week = semana do ano letivo
    // 
    // ⚠️ CRÍTICO: Calcular o total de semanas do período letivo para filtrar
    // Se o período tem 30 semanas, apenas pagelas com week <= 30 serão consideradas
    const childIds = activeChildren.map(c => c.id);
    
    let pagelasQuery: any = null;
    if (childIds.length > 0) {
      pagelasQuery = this.pagelasRepository
        .createQueryBuilder('pagela')
        .leftJoin('pagela.child', 'child')
        .leftJoin('child.club', 'club')
        .where('club.id = :clubId', { clubId })
        .andWhere('club.isActive = :clubActive', { clubActive: true })
        .andWhere('pagela.referenceDate >= :startDate', { startDate: periodStart })
        .andWhere('pagela.referenceDate <= :endDate', { endDate: periodEnd })
        .andWhere('child.id IN (:...childIds)', { childIds })
        .andWhere('child.isActive = :isActive', { isActive: true });
      
      // ⚠️ CRÍTICO: Filtrar apenas pagelas do ano letivo correto
      // Se há período letivo, garantir que year corresponde ao período
      if (hasPeriod && academicPeriod) {
        pagelasQuery = pagelasQuery.andWhere('pagela.year = :academicYear', { academicYear: academicPeriod.year });
        // Não filtramos por week aqui porque precisamos das pagelas para verificar todas as semanas
        // Mas vamos filtrar depois ao processar (apenas semanas dentro do período)
      }
    }
    
    const pagelas = childIds.length > 0 && pagelasQuery ? await pagelasQuery
      .select('pagela.year', 'year') // Ano do período letivo
      .addSelect('pagela.week', 'week') // Semana do ano letivo (1-N)
      .addSelect('pagela.referenceDate', 'referenceDate')
      .addSelect('child.id', 'childId')
      .addSelect('child.joinedAt', 'joinedAt')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('MIN(pagela.referenceDate)', 'firstDate')
      .addSelect('SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)', 'presentCount')
      .groupBy('pagela.year')
      .addGroupBy('pagela.week')
      .orderBy('pagela.year', 'ASC')
      .addOrderBy('pagela.week', 'ASC')
      .getRawMany() : [];

    // ⚠️ CRÍTICO: Calcular total de semanas do período letivo
    // Isso garante que apenas semanas dentro do período sejam contabilizadas
    let maxAcademicWeek = 0;
    if (hasPeriod && academicPeriod) {
      const start = new Date(academicPeriod.startDate);
      const end = new Date(academicPeriod.endDate);
      
      // Calcular quantas semanas completas tem no período
      const getWeekStartDate = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      };
      
      const startWeekStart = getWeekStartDate(start);
      const endWeekStart = getWeekStartDate(end);
      
      const daysDiff = Math.floor((endWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24));
      maxAcademicWeek = Math.floor(daysDiff / 7) + 1; // Última semana do período letivo
    }

    // Create map of weeks with pagela
    // ⚠️ CRÍTICO: Usar semana do ANO LETIVO (não semana ISO)
    // As pagelas já vêm com year e week do ano letivo
    // FILTRAR: Apenas pagelas dentro do período letivo (semana <= maxAcademicWeek)
    const weeksWithPagela = new Map<string, any>();
    pagelas.forEach((p) => {
      const pagelaYear = parseInt(p.year);
      const pagelaWeek = parseInt(p.week);
      
      // ⚠️ CRÍTICO: Filtrar pagelas fora do período letivo
      // Se o período tem 30 semanas, semana > 30 NÃO deve ser contabilizada
      if (hasPeriod && academicPeriod) {
        // Ignorar pagelas de outro ano letivo
        if (pagelaYear !== academicPeriod.year) {
          return; // Ignorar pagelas de outro ano letivo
        }
        
        // ⚠️ CRÍTICO: Ignorar pagelas com semana maior que o total de semanas do período
        // Exemplo: Se período tem 30 semanas, semana 31+ não deve ser contabilizada
        if (maxAcademicWeek > 0 && pagelaWeek > maxAcademicWeek) {
          return; // Ignorar pagelas fora do período letivo (semana 31+ se período tem 30 semanas)
        }
      }
      
      const key = `${pagelaYear}-W${pagelaWeek}`;
      weeksWithPagela.set(key, {
        year: pagelaYear,
        week: pagelaWeek, // Semana do ano letivo (1-N, onde N = total de semanas do período)
        totalPagelas: parseInt(p.totalPagelas),
        firstDate: p.firstDate,
        presenceCount: parseInt(p.presentCount),
      });
    });

    // Calculate all weeks in the period
    // ⚠️ CRÍTICO: Calcular semanas do ANO LETIVO, não semana ISO
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    
    const allWeeks: any[] = [];
    const missingWeeks: any[] = [];
    let currentDate = new Date(start);

    while (currentDate <= end) {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      // ⚠️ CRÍTICO: Calcular semana do ANO LETIVO (não ISO)
      // Usar getAcademicWeekYear para garantir que estamos usando semana do ano letivo
      let weekData: { year: number; week: number };
      try {
        if (hasPeriod && academicPeriod) {
          weekData = getAcademicWeekYear(
            currentDateStr,
            academicPeriod.startDate,
            academicPeriod.endDate,
            academicPeriod.year
          );
        } else {
          // Fallback para ISO se não houver período (não deveria acontecer)
          weekData = this.getISOWeekYear(currentDateStr);
        }
      } catch (error) {
        // Se a data está fora do período letivo, pular esta semana
        currentDate.setDate(currentDate.getDate() + 7);
        continue;
      }
      
      const weekKey = `${weekData.year}-W${weekData.week}`;
      
      // ✅ Verificar se a data está em uma exceção GLOBAL
      const isException = exceptionDates.has(currentDateStr);
      
      // ⚠️ CRÍTICO: Verificar se tem pagela usando semana do ano letivo
      const hasPagela = weeksWithPagela.has(weekKey);
      
      // ✅ Calcular quantas crianças ATIVAS deveriam ter pagela nesta semana
      // Considerando apenas crianças que já tinham entrado antes/durante a semana
      const weekDate = new Date(currentDateStr);
      const expectedChildren = activeChildren.filter(child => {
        // Se não tem joinedAt, considerar como se sempre estivesse no clube
        if (!child.joinedAt) return true;
        // Se tem joinedAt, verificar se já tinha entrado antes/durante a semana
        const joinedDate = new Date(child.joinedAt);
        return joinedDate <= weekDate;
      }).length;
      
      // ⚠️ CRÍTICO: Só adiciona semanas dentro do período letivo
      // Se hasPeriod é false, não adiciona à lista de semanas esperadas
      if (hasPeriod && academicPeriod) {
        // ⚠️ CRÍTICO: Validar que a semana está dentro do período letivo
        // Se período tem 30 semanas, apenas semanas 1-30 devem ser consideradas
        if (maxAcademicWeek > 0 && weekData.week > maxAcademicWeek) {
          // Semana fora do período letivo (semana 31+ se período tem 30 semanas)
          // Pular esta semana - não adicionar à lista
          currentDate.setDate(currentDate.getDate() + 7);
          continue;
        }
        
        allWeeks.push({
          year: weekData.year, // Ano do período letivo
          week: weekData.week, // Semana do ano letivo (1-N, onde N = total de semanas do período)
          date: currentDateStr,
          hasPagela,
          isException,
          expectedChildren, // ✅ Quantas crianças deveriam ter pagela
          ...weeksWithPagela.get(weekKey),
        });

        // ⚠️ CRÍTICO: Só considera "missing" se:
        // - NÃO for exceção
        // - Não tem pagela
        // - Há crianças esperadas
        // - Está dentro do período letivo (semana 1 até última semana do período)
        // - A semana está dentro do limite do período letivo (não semana 31+ se período tem 30 semanas)
        if (!hasPagela && !isException && expectedChildren > 0 && weekData.week <= maxAcademicWeek) {
          missingWeeks.push({
            year: weekData.year, // Ano do período letivo
            week: weekData.week, // Semana do ano letivo (1-N)
            expectedDate: currentDateStr,
            expectedChildren,
            weekRange: {
              start: currentDateStr,
              end: new Date(currentDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            },
            reason: 'no_pagela',
            severity: 'warning',
          });
        }
      }

      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Calculate metrics
    const weeksExpected = allWeeks.filter(w => !w.isException).length; // ✅ Apenas semanas SEM exceção
    const weeksWithPagelaCount = Array.from(weeksWithPagela.keys()).length;
    const weeksMissingCount = missingWeeks.length; // ✅ Já filtradas (não incluem exceções)
    const attendanceRate = weeksExpected > 0 ? (weeksWithPagelaCount / weeksExpected) * 100 : 0;

    // Calculate consecutive weeks (ignorando exceções)
    let consecutivePresent = 0;
    let consecutiveMissing = 0;
    let currentConsecutivePresent = 0;
    let currentConsecutiveMissing = 0;

    allWeeks.forEach((week) => {
      // ✅ Ignorar exceções no cálculo de consecutividade
      if (week.isException) {
        return; // Pular semanas de exceção
      }

      if (week.hasPagela) {
        currentConsecutivePresent++;
        currentConsecutiveMissing = 0;
        consecutivePresent = Math.max(consecutivePresent, currentConsecutivePresent);
      } else {
        currentConsecutiveMissing++;
        currentConsecutivePresent = 0;
        consecutiveMissing = Math.max(consecutiveMissing, currentConsecutiveMissing);
      }
    });

    // Generate alerts
    const alerts: any[] = [];

    if (weeksMissingCount > 0) {
      alerts.push({
        type: 'missing_weeks',
        severity: weeksMissingCount > 3 ? 'critical' : 'warning',
        message: `Clubinho tem ${weeksMissingCount} semana(s) sem pagela`,
        weeksMissing: weeksMissingCount,
      });
    }

    if (attendanceRate < 50) {
      alerts.push({
        type: 'low_attendance',
        severity: 'critical',
        message: `Taxa de frequência muito baixa: ${attendanceRate.toFixed(1)}%`,
      });
    }

    if (consecutiveMissing >= 3) {
      alerts.push({
        type: 'consecutive_missing',
        severity: 'critical',
        message: `Clubinho sem pagela por ${consecutiveMissing} semanas consecutivas`,
      });
    }

    if (pagelas.length > 0) {
      const lastPagela = pagelas[pagelas.length - 1];
      alerts.push({
        type: 'info',
        severity: 'info',
        message: `Última pagela: ${lastPagela.firstDate}`,
        lastPagelaDate: lastPagela.firstDate,
      });
    }

    return {
      clubId: club.id,
      clubNumber: club.number,
      weekday: club.weekday,
      period: {
        startDate: periodStart,
        endDate: periodEnd,
        totalWeeks: allWeeks.length,
        activeWeeks: weeksExpected, // ✅ Semanas SEM exceções
        exceptionsCount: allWeeks.filter(w => w.isException).length,
        hasAcademicPeriod: !!academicPeriod,
      },
      attendance: {
        weeksWithPagela: weeksWithPagelaCount,
        weeksExpected,
        weeksMissing: weeksMissingCount,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        consecutiveWeeksPresent: consecutivePresent,
        consecutiveWeeksMissing: consecutiveMissing,
      },
      alerts,
      timeline: (() => {
        const pageNum = page || 1;
        const limitNum = limit || 50;
        const skip = (pageNum - 1) * limitNum;
        return allWeeks.slice(skip, skip + limitNum);
      })(),
      timelinePagination: {
        page: page || 1,
        limit: limit || 50,
        total: allWeeks.length,
        totalPages: Math.ceil(allWeeks.length / (limit || 50)),
        hasNextPage: (page || 1) < Math.ceil(allWeeks.length / (limit || 50)),
        hasPreviousPage: (page || 1) > 1,
      },
      missingWeeks: (() => {
        const pageNum = page || 1;
        const limitNum = 20; // Limite fixo para missingWeeks
        const skip = (pageNum - 1) * limitNum;
        return missingWeeks.slice(skip, skip + limitNum);
      })(),
      missingWeeksPagination: {
        page: page || 1,
        limit: 20,
        total: missingWeeks.length,
        totalPages: Math.ceil(missingWeeks.length / 20),
        hasNextPage: (page || 1) < Math.ceil(missingWeeks.length / 20),
        hasPreviousPage: (page || 1) > 1,
      },
    };
  }

  private getISOWeekYear(dateStr: string): { year: number; week: number } {
    const date = new Date(dateStr + 'T00:00:00Z');
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((+d - +yearStart) / 86400000) + 1) / 7);
    return { year, week };
  }

  /**
   * Analisa frequência de todos os clubes em uma semana específica
   * 
   * ⚠️ IMPORTANTE: year e week são do ANO LETIVO, não semana ISO!
   * - year: Ano do período letivo (ex: 2024)
   * - week: Semana do ano letivo (semana 1 = primeira semana dentro do período letivo)
   * 
   * As pagelas são armazenadas com semana do ano letivo, então esses parâmetros
   * devem corresponder à semana do ano letivo, não à semana ISO do ano calendário.
   */
  async analyzeWeeklyAttendance(year: number, week: number, page?: number, limit?: number): Promise<any> {
    // ✅ VERIFICAR PERÍODO LETIVO ANTES de processar clubes
    // year é o ano do período letivo, não ano calendário
    const academicPeriod = await this.periodsRepository.findOne({
      where: { year, isActive: true },
    });

    // Se não há período letivo cadastrado, retorna clubs vazio
    if (!academicPeriod) {
      return {
        year,
        week,
        weekRange: {
          start: null,
          end: null,
        },
        clubs: [], // VAZIO quando não há período letivo
        summary: {
          totalClubs: 0,
          clubsActive: 0,
          clubsWithPagela: 0,
          clubsMissing: 0,
          attendanceRate: 0,
        },
        ...(page && limit ? {
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        } : {}),
        note: 'Período letivo não cadastrado - nenhum clube retornado',
      };
    }

    // ⚠️ CRÍTICO: Calcular data da semana ACADÊMICA (não ISO)
    // A semana passada (week) é do ano letivo, então preciso calcular a data baseada no período letivo
    const periodStartDate = new Date(academicPeriod.startDate + 'T00:00:00');
    const startWeekStart = this.getWeekStartDate(periodStartDate); // Segunda-feira da primeira semana do período
    
    // Calcular o início da semana acadêmica N (semana 1 = startWeekStart)
    // Semana 1: startWeekStart
    // Semana 2: startWeekStart + 7 dias
    // Semana N: startWeekStart + (N-1) * 7 dias
    const academicWeekStart = new Date(startWeekStart);
    academicWeekStart.setDate(startWeekStart.getDate() + (week - 1) * 7);
    const weekStart = academicWeekStart;
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 dias depois = domingo (sábado + 1 dia)
    
    // ⚠️ CRÍTICO: Verificar se a semana está dentro do período letivo
    // Calcular maxAcademicWeek para verificar se a semana passada está dentro do período
    const start = new Date(academicPeriod.startDate);
    const end = new Date(academicPeriod.endDate);
    const endWeekStart = this.getWeekStartDate(end);
    const daysDiff = Math.floor((endWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24));
    const maxAcademicWeek = Math.floor(daysDiff / 7) + 1;
    
    // Verificar se a semana está dentro do período letivo
    const periodStart = new Date(academicPeriod.startDate);
    const periodEnd = new Date(academicPeriod.endDate);
    
    // Verificar se pelo menos um dia da semana está dentro do período
    let isWeekWithinPeriod = false;
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    // Verificar se weekStart ou weekEnd estão dentro do período
    if ((weekStart >= periodStart && weekStart <= periodEnd) || 
        (weekEnd >= periodStart && weekEnd <= periodEnd) ||
        (weekStart <= periodStart && weekEnd >= periodEnd)) {
      isWeekWithinPeriod = true;
    }
    
    // ⚠️ CRÍTICO: Também verificar se a semana passada (week) não excede maxAcademicWeek
    if (week > maxAcademicWeek) {
      isWeekWithinPeriod = false;
    }
    
    // Se a semana está FORA do período letivo, retorna clubs vazio
    if (!isWeekWithinPeriod) {
      return {
        year,
        week,
        weekRange: {
          start: weekStart.toISOString().split('T')[0],
          end: weekEnd.toISOString().split('T')[0],
        },
        clubs: [], // VAZIO quando está fora do período letivo
        summary: {
          totalClubs: 0,
          clubsActive: 0,
          clubsWithPagela: 0,
          clubsMissing: 0,
          attendanceRate: 0,
        },
        ...(page && limit ? {
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        } : {}),
        period: {
          year: academicPeriod.year,
          startDate: academicPeriod.startDate,
          endDate: academicPeriod.endDate,
        },
        note: `Semana fora do período letivo (${new Date(academicPeriod.startDate).toLocaleDateString('pt-BR')} a ${new Date(academicPeriod.endDate).toLocaleDateString('pt-BR')}) - nenhum clube retornado`,
      };
    }

    // Se chegou aqui, está dentro do período letivo - processar clubes normalmente
    // Get all active clubs - apenas clubinhos ativos
    const clubs = await this.clubsRepository
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.address', 'address')
      .where('club.isActive = :isActive', { isActive: true })
      .getMany();

    // ⚠️ IMPORTANTE: Buscar pagelas pela semana do ANO LETIVO
    // year e week são do período letivo, não semana ISO
    // As pagelas são armazenadas com semana do ano letivo
    const pagelasInWeek = await this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('pagela.year = :year', { year }) // Ano do período letivo
      .andWhere('pagela.week = :week', { week }) // Semana do ano letivo
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .select('club.id', 'clubId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .groupBy('club.id')
      .getRawMany();

    const clubsWithPagela = new Map(pagelasInWeek.map((p) => [p.clubId, parseInt(p.totalPagelas)]));

    // Calculate week range (já calculado acima, reutilizando as variáveis)

    const clubsAnalysis = clubs.map((club) => {
      const hasPagela = clubsWithPagela.has(club.id);
      const totalPagelas = clubsWithPagela.get(club.id) || 0;

      // Calculate expected date based on club weekday
      const expectedDate = this.getExpectedDateForWeekday(weekStart, club.weekday);

      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        hasPagela,
        totalPagelas: hasPagela ? totalPagelas : undefined,
        expectedDate,
        status: hasPagela ? 'ok' : 'missing',
      };
    });

    const clubsActive = clubs.length;
    const clubsWithPagelaCount = clubsAnalysis.filter((c) => c.hasPagela).length;
    const clubsMissingCount = clubsActive - clubsWithPagelaCount;

    // Paginação
    const pageNum = page || 1;
    const limitNum = limit || 50;
    const skip = (pageNum - 1) * limitNum;
    const paginatedClubs = clubsAnalysis.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(clubsAnalysis.length / limitNum);

    return {
      year,
      week,
      weekRange: {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
      },
      clubs: paginatedClubs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: clubsAnalysis.length,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
      summary: {
        totalClubs: clubsActive,
        clubsActive,
        clubsWithPagela: clubsWithPagelaCount,
        clubsMissing: clubsMissingCount,
        attendanceRate: clubsActive > 0 ? (clubsWithPagelaCount / clubsActive) * 100 : 0,
      },
    };
  }

  /**
   * Obter a data de início da semana (segunda-feira) para uma data
   */
  private getWeekStartDate(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para segunda-feira
    return new Date(d.setDate(diff));
  }

  private getExpectedDateForWeekday(weekStart: Date, weekday: string): string {
    const weekdayMap = {
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
      SUNDAY: 0, // Nunca usado
    };

    const targetDay = weekdayMap[weekday] || 1;
    const currentDay = weekStart.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;

    const expectedDate = new Date(weekStart.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return expectedDate.toISOString().split('T')[0];
  }
}
