import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { ChildEntity } from '../../children/entities/child.entity';
import { ClubEntity } from '../../clubs/entities/club.entity';
import { TeacherProfileEntity } from '../../teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { ClubsStatsQueryDto } from '../dto/clubs-stats-query.dto';
import { TeachersStatsQueryDto } from '../dto/teachers-stats-query.dto';
import {
  AcceptedChristsByClubRaw,
  ChildStatsRaw,
  ClubsWithStatsResult,
  PagelasByClubRaw,
  TeacherDecisionStatsRaw,
  TeacherStatsRaw,
  TeachersWithStatsResult,
} from '../dto/statistics-raw-results.dto';
import { toDateOnly } from '../utils/date.utils';

/**
 * Consultas de clubinhos e professores.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas.
 */
@Injectable()
export class ClubsTeachersStatisticsRepository {
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

  async getClubsWithStats(
    filters: ClubsStatsQueryDto,
  ): Promise<ClubsWithStatsResult> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.clubsRepository
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.address', 'address')
      .leftJoinAndSelect('club.coordinator', 'coordinator')
      .leftJoin('coordinator.user', 'coordinatorUser')
      .where('club.isActive = :isActive', { isActive: true });

    if (filters.coordinatorId) {
      query.andWhere('coordinator.id = :coordinatorId', {
        coordinatorId: filters.coordinatorId,
      });
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
      query.andWhere('address.district = :district', {
        district: filters.district,
      });
    }

    query.orderBy('club.number', 'ASC');

    const clubs = await query.getMany();
    const clubIds = clubs.map((c) => c.id);

    if (clubIds.length === 0) {
      return {
        clubs: [],
        allFilteredClubs: [],
        childrenResults: [],
        allChildrenResults: [],
        pagelasResults: [],
        allPagelasResults: [],
        decisionsResults: [],
        allDecisionsResults: [],
        teachers: [],
        allTeachers: [],
        totalCount: 0,
        page,
        limit,
        inactiveClubs: { total: 0, list: [] },
        inactiveChildren: { total: 0, fromInactiveClubs: 0 },
      };
    }

    const childrenQuery = this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .select('child.club.id', 'clubId')
      .addSelect('COUNT(child.id)', 'total')
      .addSelect('child.gender', 'gender')
      .addSelect(
        'AVG(TIMESTAMPDIFF(YEAR, child.birthDate, CURDATE()))',
        'avgAge',
      )
      .where('child.club.id IN (:...clubIds)', { clubIds })
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .groupBy('child.club.id')
      .addGroupBy('child.gender');

    const childrenResults = await childrenQuery.getRawMany<ChildStatsRaw>();

    const pagelasQuery = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .select('child.club.id', 'clubId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('COUNT(DISTINCT child.id)', 'activeChildren')
      .addSelect('COUNT(DISTINCT pagela.teacher.id)', 'activeTeachers')
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
      .where('child.club.id IN (:...clubIds)', { clubIds })
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .groupBy('child.club.id');

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

    const pagelasResults = await pagelasQuery.getRawMany<PagelasByClubRaw>();

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

    if (filters.startDate) {
      decisionsQuery.andWhere('ac.createdAt >= :decisionStartDate', {
        decisionStartDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      const decisionEndExclusive = new Date(`${filters.endDate}T00:00:00Z`);
      decisionEndExclusive.setUTCDate(decisionEndExclusive.getUTCDate() + 1);
      decisionsQuery.andWhere('ac.createdAt < :decisionEndExclusive', {
        decisionEndExclusive: toDateOnly(decisionEndExclusive),
      });
    }

    const decisionsResults =
      await decisionsQuery.getRawMany<AcceptedChristsByClubRaw>();

    const teachersQuery = this.teachersRepository
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .leftJoin('teacher.club', 'club')
      .where('club.id IN (:...clubIds)', { clubIds })
      .andWhere('club.isActive = :clubActive', { clubActive: true });

    const teachers = await teachersQuery.getMany();

    const childrenMap = new Map<string, number>();
    childrenResults.forEach((r) => {
      if (!childrenMap.has(r.clubId)) childrenMap.set(r.clubId, 0);
      childrenMap.set(
        r.clubId,
        (childrenMap.get(r.clubId) || 0) + parseInt(r.total),
      );
    });

    const pagelasMap = new Map(pagelasResults.map((p) => [p.clubId, p]));
    const decisionsMap = new Map(decisionsResults.map((d) => [d.clubId, d]));
    const teachersMap = new Map<string, number>();
    teachers.forEach((t) => {
      if (t.club) {
        if (!teachersMap.has(t.club.id)) teachersMap.set(t.club.id, 0);
        const currentCount = teachersMap.get(t.club.id) || 0;
        teachersMap.set(t.club.id, currentCount + 1);
      }
    });

    let clubsWithProcessedStats = clubs.map((club) => {
      const pagelaStats = pagelasMap.get(club.id);
      const decisionStats = decisionsMap.get(club.id);

      const totalPagelas = pagelaStats
        ? parseInt(pagelaStats.totalPagelas || '0')
        : 0;
      const presenceCount = pagelaStats
        ? parseInt(pagelaStats.presenceCount || '0')
        : 0;
      const meditationCount = pagelaStats
        ? parseInt(pagelaStats.meditationCount || '0')
        : 0;
      const verseCount = pagelaStats
        ? parseInt(pagelaStats.verseCount || '0')
        : 0; // Fixed: was missing in original map logic

      const totalChildren = childrenMap.get(club.id) || 0;
      const activeChildren = pagelaStats
        ? parseInt(pagelaStats.activeChildren || '0')
        : 0;

      const totalDecisions = decisionStats
        ? parseInt(decisionStats.totalDecisions || '0')
        : 0;
      const totalTeachers = teachersMap.get(club.id) || 0;

      const avgPresenceRate =
        totalPagelas > 0 ? (presenceCount / totalPagelas) * 100 : 0;
      const avgMeditationRate =
        totalPagelas > 0 ? (meditationCount / totalPagelas) * 100 : 0;
      const avgVerseRate =
        totalPagelas > 0 ? (verseCount / totalPagelas) * 100 : 0;
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
        ...club,
        stats: {
          totalChildren,
          totalTeachers,
          totalDecisions,
          avgPresenceRate,
          avgMeditationRate,
          avgVerseRate,
          performanceScore,
        },
      };
    });

    if (filters.minChildren !== undefined) {
      clubsWithProcessedStats = clubsWithProcessedStats.filter(
        (c) => c.stats.totalChildren >= filters.minChildren!,
      );
    }
    if (filters.maxChildren !== undefined) {
      clubsWithProcessedStats = clubsWithProcessedStats.filter(
        (c) => c.stats.totalChildren <= filters.maxChildren!,
      );
    }

    if (filters.minPresenceRate !== undefined) {
      clubsWithProcessedStats = clubsWithProcessedStats.filter(
        (c) => c.stats.avgPresenceRate >= filters.minPresenceRate!,
      );
    }
    if (filters.maxPresenceRate !== undefined) {
      clubsWithProcessedStats = clubsWithProcessedStats.filter(
        (c) => c.stats.avgPresenceRate <= filters.maxPresenceRate!,
      );
    }

    if (filters.minPerformanceScore !== undefined) {
      clubsWithProcessedStats = clubsWithProcessedStats.filter(
        (c) => c.stats.performanceScore >= filters.minPerformanceScore!,
      );
    }
    if (filters.maxPerformanceScore !== undefined) {
      clubsWithProcessedStats = clubsWithProcessedStats.filter(
        (c) => c.stats.performanceScore <= filters.maxPerformanceScore!,
      );
    }

    if (filters.minDecisions !== undefined) {
      clubsWithProcessedStats = clubsWithProcessedStats.filter(
        (c) => c.stats.totalDecisions >= filters.minDecisions!,
      );
    }

    if (filters.minTeachers !== undefined) {
      clubsWithProcessedStats = clubsWithProcessedStats.filter(
        (c) => c.stats.totalTeachers >= filters.minTeachers!,
      );
    }

    const sortBy = filters.sortBy || 'clubNumber';
    const sortOrder = filters.sortOrder || 'ASC';

    clubsWithProcessedStats.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortBy) {
        case 'performanceScore':
          valA = a.stats.performanceScore;
          valB = b.stats.performanceScore;
          break;
        case 'presenceRate':
          valA = a.stats.avgPresenceRate;
          valB = b.stats.avgPresenceRate;
          break;
        case 'totalChildren':
          valA = a.stats.totalChildren;
          valB = b.stats.totalChildren;
          break;
        case 'totalDecisions':
          valA = a.stats.totalDecisions;
          valB = b.stats.totalDecisions;
          break;
        case 'clubNumber':
          valA = a.number;
          valB = b.number;
          break;
        default:
          valA =
            ((a as unknown as Record<string, unknown>)[sortBy] as
              | number
              | string) || 0;
          valB =
            ((b as unknown as Record<string, unknown>)[sortBy] as
              | number
              | string) || 0;
      }

      if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
      if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });

    const totalCount = clubsWithProcessedStats.length;
    const paginatedClubs = clubsWithProcessedStats.slice(skip, skip + limit);

    const allClubs = await this.clubsRepository.find();
    const inactiveClubs = allClubs.filter((c) => c.isActive === false);

    const inactiveChildrenQuery = this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .select('COUNT(child.id)', 'total')
      .where('child.isActive = :isActive', { isActive: false });
    const inactiveChildrenCount = await inactiveChildrenQuery.getRawOne<{
      total: string;
    }>();

    const childrenFromInactiveClubsQuery = this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .select('COUNT(child.id)', 'total')
      .where('club.isActive = :clubActive', { clubActive: false });
    const childrenFromInactiveClubsCount =
      await childrenFromInactiveClubsQuery.getRawOne<{ total: string }>();

    const paginatedClubIds = new Set(paginatedClubs.map((c) => c.id));

    return {
      clubs: paginatedClubs.map((c) => {
        const { stats, ...originalClub } = c;
        void stats;
        return originalClub;
      }),
      allFilteredClubs: clubsWithProcessedStats.map((c) => {
        const { stats, ...originalClub } = c;
        void stats;
        return originalClub;
      }),
      childrenResults: childrenResults.filter((r) =>
        paginatedClubIds.has(r.clubId),
      ),
      allChildrenResults: childrenResults,
      pagelasResults: pagelasResults.filter((r) =>
        paginatedClubIds.has(r.clubId),
      ),
      allPagelasResults: pagelasResults,
      decisionsResults: decisionsResults.filter((r) =>
        paginatedClubIds.has(r.clubId),
      ),
      allDecisionsResults: decisionsResults,
      teachers: teachers.filter(
        (t) => t.club && paginatedClubIds.has(t.club.id),
      ),
      allTeachers: teachers,
      totalCount,
      page,
      limit,

      inactiveClubs: {
        total: inactiveClubs.length,
        list: inactiveClubs.map((club) => ({
          clubId: club.id,
          clubNumber: club.number,
          weekday: club.weekday,
          isActive: club.isActive,
        })),
      },
      inactiveChildren: {
        total: parseInt(inactiveChildrenCount?.total || '0', 10),
        fromInactiveClubs: parseInt(
          childrenFromInactiveClubsCount?.total || '0',
          10,
        ),
      },
    };
  }

  async getTeachersWithStats(
    filters: TeachersStatsQueryDto,
  ): Promise<TeachersWithStatsResult> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.teachersRepository
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .leftJoinAndSelect('teacher.club', 'club')
      .leftJoin('club.address', 'address')
      .leftJoin('club.coordinator', 'coordinator')
      .where('club.isActive = :clubActive', { clubActive: true });

    if (filters.clubId) {
      query.andWhere('club.id = :clubId', { clubId: filters.clubId });
    }

    if (filters.coordinatorId) {
      query.andWhere('coordinator.id = :coordinatorId', {
        coordinatorId: filters.coordinatorId,
      });
    }

    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }

    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }

    if (filters.search) {
      query.andWhere('user.name LIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    query.orderBy('user.name', 'ASC');

    const teachers = await query.getMany();
    const teacherIds = teachers.map((t) => t.id);
    if (teacherIds.length === 0) {
      return {
        teachers: [],
        allFilteredTeachers: [],
        pagelasResults: [],
        allPagelasResults: [],
        decisionsResults: [],
        allDecisionsResults: [],
        totalCount: 0,
        page,
        limit,
      };
    }

    const pagelasQuery = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .select('pagela.teacher.id', 'teacherId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN pagela.present = 1 THEN child.id END)',
        'activeChildren',
      )
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
      .where('pagela.teacher.id IN (:...teacherIds)', { teacherIds })
      .groupBy('pagela.teacher.id');

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

    const pagelasResults = await pagelasQuery.getRawMany<TeacherStatsRaw>();

    const decisionsQuery = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.pagelas', 'pagela')
      .select('pagela.teacher.id', 'teacherId')
      .addSelect('COUNT(DISTINCT child.id)', 'childrenWithDecisions')
      .where('pagela.teacher.id IN (:...teacherIds)', { teacherIds })
      .andWhere('child.isActive = :childActive', { childActive: true })
      .groupBy('pagela.teacher.id');

    if (filters.startDate) {
      decisionsQuery
        .andWhere('pagela.referenceDate >= :decisionPagelaStartDate', {
          decisionPagelaStartDate: filters.startDate,
        })
        .andWhere('ac.createdAt >= :decisionStartDate', {
          decisionStartDate: filters.startDate,
        });
    }
    if (filters.endDate) {
      const decisionEndExclusive = new Date(`${filters.endDate}T00:00:00Z`);
      decisionEndExclusive.setUTCDate(decisionEndExclusive.getUTCDate() + 1);
      const endDateExclusive = toDateOnly(decisionEndExclusive);
      decisionsQuery
        .andWhere('pagela.referenceDate < :decisionPagelaEndExclusive', {
          decisionPagelaEndExclusive: endDateExclusive,
        })
        .andWhere('ac.createdAt < :decisionEndExclusive', {
          decisionEndExclusive: endDateExclusive,
        });
    }

    const decisionsResults =
      await decisionsQuery.getRawMany<TeacherDecisionStatsRaw>();

    const pagelasMap = new Map(pagelasResults.map((p) => [p.teacherId, p]));
    const decisionsMap = new Map(decisionsResults.map((d) => [d.teacherId, d]));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = toDateOnly(thirtyDaysAgo);

    let teachersWithProcessedStats = teachers.map((teacher) => {
      const pagelas = pagelasMap.get(teacher.id);
      const decisions = decisionsMap.get(teacher.id);

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
        avgPresenceRate * 0.3 +
        avgMeditationRate * 0.3 +
        avgVerseRate * 0.2 +
        decisionRate * 0.2;

      const lastActivity = pagelas?.lastActivity;
      const isActive = lastActivity
        ? new Date(lastActivity) >= new Date(thirtyDaysAgoStr)
        : false;

      return {
        ...teacher,
        stats: {
          totalPagelas,
          uniqueChildren,
          childrenWithDecisions,
          avgPresenceRate,
          effectivenessScore,
          isActive,
        },
      };
    });

    if (filters.minPagelas !== undefined) {
      teachersWithProcessedStats = teachersWithProcessedStats.filter(
        (t) => t.stats.totalPagelas >= filters.minPagelas!,
      );
    }

    if (filters.minChildren !== undefined) {
      teachersWithProcessedStats = teachersWithProcessedStats.filter(
        (t) => t.stats.uniqueChildren >= filters.minChildren!,
      );
    }

    if (filters.minPresenceRate !== undefined) {
      teachersWithProcessedStats = teachersWithProcessedStats.filter(
        (t) => t.stats.avgPresenceRate >= filters.minPresenceRate!,
      );
    }
    if (filters.maxPresenceRate !== undefined) {
      teachersWithProcessedStats = teachersWithProcessedStats.filter(
        (t) => t.stats.avgPresenceRate <= filters.maxPresenceRate!,
      );
    }

    if (filters.minEffectivenessScore !== undefined) {
      teachersWithProcessedStats = teachersWithProcessedStats.filter(
        (t) => t.stats.effectivenessScore >= filters.minEffectivenessScore!,
      );
    }
    if (filters.maxEffectivenessScore !== undefined) {
      teachersWithProcessedStats = teachersWithProcessedStats.filter(
        (t) => t.stats.effectivenessScore <= filters.maxEffectivenessScore!,
      );
    }

    if (filters.isActive !== undefined) {
      teachersWithProcessedStats = teachersWithProcessedStats.filter(
        (t) => t.stats.isActive === filters.isActive,
      );
    }

    if (filters.minDecisions !== undefined) {
      teachersWithProcessedStats = teachersWithProcessedStats.filter(
        (t) => t.stats.childrenWithDecisions >= filters.minDecisions!,
      );
    }

    const sortBy = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'ASC';

    teachersWithProcessedStats.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortBy) {
        case 'effectivenessScore':
          valA = a.stats.effectivenessScore;
          valB = b.stats.effectivenessScore;
          break;
        case 'presenceRate':
          valA = a.stats.avgPresenceRate;
          valB = b.stats.avgPresenceRate;
          break;
        case 'totalChildren':
          valA = a.stats.uniqueChildren;
          valB = b.stats.uniqueChildren;
          break;
        case 'name':
          valA = a.user?.name || '';
          valB = b.user?.name || '';
          return sortOrder === 'ASC'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        default:
          valA =
            ((a as unknown as Record<string, unknown>)[sortBy] as
              | number
              | string) || 0;
          valB =
            ((b as unknown as Record<string, unknown>)[sortBy] as
              | number
              | string) || 0;
      }

      if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
      if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });

    const totalCount = teachersWithProcessedStats.length;
    const paginatedTeachers = teachersWithProcessedStats.slice(
      skip,
      skip + limit,
    );

    const paginatedTeacherIds = new Set(paginatedTeachers.map((t) => t.id));

    return {
      teachers: paginatedTeachers.map((t) => {
        const { stats, ...originalTeacher } = t;
        void stats;
        return originalTeacher;
      }),
      allFilteredTeachers: teachersWithProcessedStats.map((t) => {
        const { stats, ...originalTeacher } = t;
        void stats;
        return originalTeacher;
      }),
      pagelasResults: pagelasResults.filter((r) =>
        paginatedTeacherIds.has(r.teacherId),
      ),
      allPagelasResults: pagelasResults,
      decisionsResults: decisionsResults.filter((r) =>
        paginatedTeacherIds.has(r.teacherId),
      ),
      allDecisionsResults: decisionsResults,
      totalCount,
      page,
      limit,
    };
  }
}
