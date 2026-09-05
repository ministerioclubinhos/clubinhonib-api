import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { getAcademicWeek } from 'src/shared/academic-week/academic-week.util';

import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { ChildEntity } from '../../children/entities/child.entity';
import { ClubEntity } from '../../clubs/entities/club.entity';
import { ClubPeriodEntity } from '../../club-control/entities/club-period.entity';
import { ClubExceptionEntity } from '../../club-control/entities/club-exception.entity';
import {
  ClubAttendanceAlertDto,
  ClubAttendanceAnalysisDto,
  WeeklyAttendanceDto,
  WeeklyClubStatus,
} from '../dto/club-attendance-analysis.dto';
import { addDays, toDateOnly } from '../utils/date.utils';

/**
 * Uma semana da linha do tempo de frequência de um clubinho.
 *
 * Era o mesmo tipo, com tudo opcional, servindo a duas formas diferentes: a
 * linha do tempo e a lista de semanas faltando. Com tudo opcional o TypeScript
 * não conseguia dizer que o contrato da rota estava sendo cumprido — e não
 * estava.
 */
interface TimelineWeek {
  year: number;
  week: number;
  date: string;
  hasPagela: boolean;
  isException: boolean;
  isPending: boolean;
  expectedChildren: number;
  /** Presentes vêm só quando a semana tem pagela. */
  totalPagelas?: number;
  firstDate?: string | Date;
  presenceCount?: number;
}

/** Uma semana em que o clubinho era esperado e não registrou pagela. */
interface MissingWeek {
  year: number;
  week: number;
  expectedDate: string;
  expectedChildren: number;
  weekRange: { start: string; end: string };
  reason: 'no_pagela';
  severity: 'warning';
}

/** Linha crua da agregação de pagelas por semana. */
interface PagelaAttendanceRaw {
  year: string;
  week: string;
  totalPagelas: string;
  firstDate: string;
  presentCount: string;
}

/** Uma pagela agregada por semana, para montar a linha do tempo. */
interface PagelaAttendanceData {
  year: number;
  week: number;
  totalPagelas: number;
  firstDate: string | Date;
  presenceCount: number;
}

/**
 * Consultas de frequência de clubinho.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas. Este bloco não compartilhava nada com o resto — nem os três
 * auxiliares de semana, nem o serviço de filtros — então é a fatia que sai
 * inteira sem tocar em nenhuma outra.
 */
@Injectable()
export class AttendanceStatisticsRepository {
  constructor(
    @InjectRepository(PagelaEntity)
    private readonly pagelasRepository: Repository<PagelaEntity>,
    @InjectRepository(ChildEntity)
    private readonly childrenRepository: Repository<ChildEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubsRepository: Repository<ClubEntity>,
    @InjectRepository(ClubPeriodEntity)
    private readonly periodsRepository: Repository<ClubPeriodEntity>,
    @InjectRepository(ClubExceptionEntity)
    private readonly exceptionsRepository: Repository<ClubExceptionEntity>,
  ) {}

  async analyzeClubAttendance(
    clubId: string,
    year: number,
    startDate?: string,
    endDate?: string,
    page?: number,
    limit?: number,
  ): Promise<ClubAttendanceAnalysisDto> {
    const club = await this.clubsRepository.findOne({
      where: { id: clubId },
      relations: ['address'],
    });

    if (!club) {
      throw new Error('Clubinho not found');
    }

    const academicPeriod = await this.periodsRepository.findOne({
      where: { year, isActive: true },
    });

    const hasPeriod = !!academicPeriod;

    const periodStart =
      academicPeriod?.startDate || startDate || `${year}-01-01`;
    const periodEnd = academicPeriod?.endDate || endDate || `${year}-12-31`;

    const exceptions = await this.exceptionsRepository.find({
      where: { isActive: true },
    });

    const allChildren = await this.childrenRepository.find({
      where: { club: { id: clubId } },
    });

    const activeChildren = allChildren.filter(
      (child) => child.isActive === true,
    );

    const childIds = activeChildren.map((c) => c.id);

    let pagelasQuery: SelectQueryBuilder<PagelaEntity> | null = null;
    if (childIds.length > 0) {
      pagelasQuery = this.pagelasRepository
        .createQueryBuilder('pagela')
        .leftJoin('pagela.child', 'child')
        .leftJoin('child.club', 'club')
        .where('club.id = :clubId', { clubId })
        .andWhere('club.isActive = :clubActive', { clubActive: true })
        .andWhere('pagela.referenceDate >= :startDate', {
          startDate: periodStart,
        })
        .andWhere('pagela.referenceDate <= :endDate', { endDate: periodEnd })
        .andWhere('child.id IN (:...childIds)', { childIds })
        .andWhere('child.isActive = :isActive', { isActive: true });

      if (hasPeriod && academicPeriod) {
        pagelasQuery = pagelasQuery.andWhere('pagela.year = :academicYear', {
          academicYear: academicPeriod.year,
        });
      }
    }

    const pagelas =
      childIds.length > 0 && pagelasQuery
        ? await pagelasQuery
            .select('pagela.year', 'year')
            .addSelect('pagela.week', 'week')
            .addSelect('COUNT(pagela.id)', 'totalPagelas')
            .addSelect('MIN(pagela.referenceDate)', 'firstDate')
            .addSelect(
              'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
              'presentCount',
            )
            .groupBy('pagela.year')
            .addGroupBy('pagela.week')
            .orderBy('pagela.year', 'ASC')
            .addOrderBy('pagela.week', 'ASC')
            .getRawMany<PagelaAttendanceRaw>()
        : [];

    let maxAcademicWeek = 0;
    if (hasPeriod && academicPeriod) {
      const start = new Date(academicPeriod.startDate);
      const end = new Date(academicPeriod.endDate);

      const getWeekStartDate = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      };

      const startWeekStart = getWeekStartDate(start);
      const endWeekStart = getWeekStartDate(end);

      const daysDiff = Math.floor(
        (endWeekStart.getTime() - startWeekStart.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      maxAcademicWeek = Math.floor(daysDiff / 7) + 1;
    }

    const weeksWithPagela = new Map<string, PagelaAttendanceData>();
    pagelas.forEach((p) => {
      const pagelaYear = parseInt(p.year);
      const pagelaWeek = parseInt(p.week);

      if (hasPeriod && academicPeriod) {
        if (pagelaYear !== academicPeriod.year) {
          return;
        }

        if (maxAcademicWeek > 0 && pagelaWeek > maxAcademicWeek) {
          return;
        }
      }

      const key = `${pagelaYear}-W${pagelaWeek}`;
      weeksWithPagela.set(key, {
        year: pagelaYear,
        week: pagelaWeek,
        totalPagelas: parseInt(p.totalPagelas),
        firstDate: p.firstDate,
        presenceCount: parseInt(p.presentCount),
      });
    });

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const allWeeks: TimelineWeek[] = [];
    const missingWeeks: MissingWeek[] = [];
    const firstWeekStart = this.getWeekStartDate(start);
    const currentDate = new Date(
      this.getExpectedDateForWeekday(firstWeekStart, club.weekday),
    );
    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    while (currentDate <= end) {
      const currentDateStr = toDateOnly(currentDate);

      // Fora do período letivo não há semana a contar; o dia é pulado.
      const weekData =
        hasPeriod && academicPeriod
          ? getAcademicWeek(currentDateStr, academicPeriod)
          : this.getISOWeekYear(currentDateStr);

      if (!weekData) {
        currentDate.setDate(currentDate.getDate() + 7);
        continue;
      }

      const weekKey = `${weekData.year}-W${weekData.week}`;

      const isException = exceptions.some(
        (exception) =>
          exception.exceptionDate === currentDateStr ||
          (exception.isRecurrent &&
            exception.exceptionDate.slice(5) === currentDateStr.slice(5)),
      );
      const isPending = currentDateStr >= todayStr;

      const hasPagela = weeksWithPagela.has(weekKey);

      const weekDate = new Date(currentDateStr);
      const expectedChildren = activeChildren.filter((child) => {
        if (!child.joinedAt) return true;

        const joinedDate = new Date(child.joinedAt);
        return joinedDate <= weekDate;
      }).length;

      if (hasPeriod && academicPeriod) {
        if (maxAcademicWeek > 0 && weekData.week > maxAcademicWeek) {
          currentDate.setDate(currentDate.getDate() + 7);
          continue;
        }

        allWeeks.push({
          year: weekData.year,
          week: weekData.week,
          date: currentDateStr,
          hasPagela,
          isException,
          isPending,
          expectedChildren,
          ...weeksWithPagela.get(weekKey),
        });

        if (
          !hasPagela &&
          !isException &&
          !isPending &&
          expectedChildren > 0 &&
          weekData.week <= maxAcademicWeek
        ) {
          missingWeeks.push({
            year: weekData.year,
            week: weekData.week,
            expectedDate: currentDateStr,
            expectedChildren,
            weekRange: {
              start: currentDateStr,
              end: toDateOnly(addDays(currentDate, 6)),
            },
            reason: 'no_pagela',
            severity: 'warning',
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 7);
    }

    const weeksExpected = allWeeks.filter(
      (week) => !week.isException && !week.isPending,
    ).length;
    const weeksWithPagelaCount = allWeeks.filter(
      (week) => !week.isException && !week.isPending && week.hasPagela,
    ).length;
    const weeksMissingCount = missingWeeks.length;
    const attendanceRate =
      weeksExpected > 0 ? (weeksWithPagelaCount / weeksExpected) * 100 : 0;

    let consecutivePresent = 0;
    let consecutiveMissing = 0;
    let currentConsecutivePresent = 0;
    let currentConsecutiveMissing = 0;

    allWeeks.forEach((week) => {
      if (week.isException || week.isPending) {
        return;
      }

      if (week.hasPagela) {
        currentConsecutivePresent++;
        currentConsecutiveMissing = 0;
        consecutivePresent = Math.max(
          consecutivePresent,
          currentConsecutivePresent,
        );
      } else {
        currentConsecutiveMissing++;
        currentConsecutivePresent = 0;
        consecutiveMissing = Math.max(
          consecutiveMissing,
          currentConsecutiveMissing,
        );
      }
    });

    const alerts: ClubAttendanceAlertDto[] = [];

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
        // `MIN(date)` chega ora como texto, ora como `Date`.
        lastPagelaDate: String(lastPagela.firstDate),
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
        activeWeeks: weeksExpected,
        exceptionsCount: allWeeks.filter((w) => w.isException).length,
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
        const limitNum = 20;
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
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
    return { year, week };
  }

  async analyzeWeeklyAttendance(
    year: number,
    week: number,
    page?: number,
    limit?: number,
  ): Promise<WeeklyAttendanceDto> {
    const academicPeriod = await this.periodsRepository.findOne({
      where: { year, isActive: true },
    });

    if (!academicPeriod) {
      return {
        year,
        week,
        weekRange: {
          start: null,
          end: null,
        },
        clubs: [],
        summary: {
          totalClubs: 0,
          clubsActive: 0,
          clubsWithPagela: 0,
          clubsMissing: 0,
          attendanceRate: 0,
        },
        ...(page && limit
          ? {
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            }
          : {}),
        note: 'Período letivo não cadastrado - nenhum clube retornado',
      };
    }

    const periodStartDate = new Date(academicPeriod.startDate + 'T00:00:00');
    const startWeekStart = this.getWeekStartDate(periodStartDate);

    const academicWeekStart = new Date(startWeekStart);
    academicWeekStart.setDate(startWeekStart.getDate() + (week - 1) * 7);
    const weekStart = academicWeekStart;
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    const end = new Date(academicPeriod.endDate);
    const endWeekStart = this.getWeekStartDate(end);
    const daysDiff = Math.floor(
      (endWeekStart.getTime() - startWeekStart.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const maxAcademicWeek = Math.floor(daysDiff / 7) + 1;

    const periodStart = new Date(academicPeriod.startDate);
    const periodEnd = new Date(academicPeriod.endDate);

    let isWeekWithinPeriod = false;

    if (
      (weekStart >= periodStart && weekStart <= periodEnd) ||
      (weekEnd >= periodStart && weekEnd <= periodEnd) ||
      (weekStart <= periodStart && weekEnd >= periodEnd)
    ) {
      isWeekWithinPeriod = true;
    }

    if (week > maxAcademicWeek) {
      isWeekWithinPeriod = false;
    }

    if (!isWeekWithinPeriod) {
      return {
        year,
        week,
        weekRange: {
          start: toDateOnly(weekStart),
          end: toDateOnly(weekEnd),
        },
        clubs: [],
        summary: {
          totalClubs: 0,
          clubsActive: 0,
          clubsWithPagela: 0,
          clubsMissing: 0,
          attendanceRate: 0,
        },
        ...(page && limit
          ? {
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            }
          : {}),
        period: {
          year: academicPeriod.year,
          startDate: academicPeriod.startDate,
          endDate: academicPeriod.endDate,
        },
        note: `Semana fora do período letivo (${new Date(academicPeriod.startDate).toLocaleDateString('pt-BR')} a ${new Date(academicPeriod.endDate).toLocaleDateString('pt-BR')}) - nenhum clube retornado`,
      };
    }

    const clubs = await this.clubsRepository
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.address', 'address')
      .where('club.isActive = :isActive', { isActive: true })
      .getMany();

    const pagelasInWeek = await this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('pagela.year = :year', { year })
      .andWhere('pagela.week = :week', { week })
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :childActive', { childActive: true })
      .select('club.id', 'clubId')
      .addSelect('COUNT(DISTINCT child.id)', 'totalPagelas')
      .groupBy('club.id')
      .getRawMany<{ clubId: string; totalPagelas: string }>();

    const clubsWithPagela = new Map(
      pagelasInWeek.map((p) => [p.clubId, parseInt(p.totalPagelas)]),
    );

    const [activeChildren, exceptions] = await Promise.all([
      this.childrenRepository.find({
        where: { isActive: true },
        relations: ['club'],
      }),
      this.exceptionsRepository.find({ where: { isActive: true } }),
    ]);

    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    const clubsAnalysis = clubs.map((club) => {
      const totalPagelas = clubsWithPagela.get(club.id) || 0;

      const expectedDate = this.getExpectedDateForWeekday(
        weekStart,
        club.weekday,
      );

      const expectedChildren = activeChildren.filter((child) => {
        if (child.club?.id !== club.id) return false;
        return (
          !child.joinedAt ||
          new Date(child.joinedAt) <= new Date(`${expectedDate}T23:59:59`)
        );
      }).length;
      const exception = exceptions.find(
        (item) =>
          item.exceptionDate === expectedDate ||
          (item.isRecurrent &&
            item.exceptionDate.slice(5) === expectedDate.slice(5)),
      );
      const hasPagela = totalPagelas > 0;

      // Declarado com o tipo do contrato: um estado novo aqui passa a exigir
      // que ele seja acrescentado à união que a tela recebe.
      let status: WeeklyClubStatus = 'missing';
      if (exception) status = 'vacation';
      else if (expectedDate >= todayStr) status = 'pending';
      else if (expectedChildren === 0) status = 'inactive';
      else if (totalPagelas >= expectedChildren) status = 'ok';
      else if (totalPagelas > 0) status = 'partial';

      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        hasPagela,
        totalPagelas: hasPagela ? totalPagelas : undefined,
        expectedChildren,
        expectedDate,
        status,
      };
    });

    const expectedClubs = clubsAnalysis.filter((club) =>
      ['ok', 'partial', 'missing'].includes(club.status),
    );
    const clubsActive = expectedClubs.length;
    const clubsWithPagelaCount = expectedClubs.filter(
      (c) => c.hasPagela,
    ).length;
    const clubsMissingCount = expectedClubs.filter(
      (club) => club.status === 'missing',
    ).length;

    const pageNum = page || 1;
    const limitNum = limit || 50;
    const skip = (pageNum - 1) * limitNum;
    const paginatedClubs = clubsAnalysis.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(clubsAnalysis.length / limitNum);

    return {
      year,
      week,
      weekRange: {
        start: toDateOnly(weekStart),
        end: toDateOnly(weekEnd),
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
        attendanceRate:
          clubsActive > 0 ? (clubsWithPagelaCount / clubsActive) * 100 : 0,
      },
    };
  }

  private getWeekStartDate(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  private getExpectedDateForWeekday(weekStart: Date, weekday: string): string {
    const weekdayMap = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
    };

    const normalizedWeekday = weekday.toLowerCase() as keyof typeof weekdayMap;
    const targetDay = weekdayMap[normalizedWeekday] ?? 1;
    const currentDay = weekStart.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;

    const expectedDate = new Date(
      weekStart.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
    );
    return toDateOnly(expectedDate);
  }
}
