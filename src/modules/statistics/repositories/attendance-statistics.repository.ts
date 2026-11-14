import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { todayInAppTimezone } from 'src/shared/calendar-day/calendar-day.util';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';

import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { ClubEntity } from '../../clubs/entities/club.entity';
import { ClubPeriodEntity } from '../../club-control/entities/club-period.entity';
import {
  AttendancePaginationDto,
  ClubAttendanceAlertDto,
  ClubAttendanceAnalysisDto,
  WeeklyAttendanceDto,
  WeeklyClubStatus,
} from '../dto/club-attendance-analysis.dto';
import {
  ATTENDANCE_DEFAULT_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  CRITICAL_MISSING_WEEKS,
  ENROLLED_AT_PAGELA_DATE_SQL,
  LOW_WEEKLY_ATTENDANCE_THRESHOLD,
  MISSING_WEEKS_PAGE_SIZE,
} from '../constants';
import { formatDateOnlyPtBr } from '../utils/date.utils';
import {
  addDaysToDateOnly,
  clubDayInWeek,
  countEnrolledAt,
  isExceptionDay,
  listAcademicWeeks,
  mondayOf,
} from '../utils/enrollment.utils';
import { percentage, roundToOneDecimal, toCount } from '../utils/metrics.utils';
import { ExpectedChildrenRepository } from './expected-children.repository';

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
  firstDate?: string;
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
  firstDate: string;
  presenceCount: number;
}

/** Situações em que o clubinho devia ter lançado pagela na semana. */
const EXPECTED_CLUB_STATUSES: readonly WeeklyClubStatus[] = [
  'ok',
  'partial',
  'missing',
];

/**
 * A semana conta para a frequência do clubinho?
 *
 * Fica de fora a semana de exceção, a que ainda não chegou e a que não tinha
 * criança esperada — nesta não havia pagela a lançar. Antes ela entrava no
 * denominador (`weeksExpected`) mas nunca na lista de faltas, e um clubinho
 * que começou em agosto aparecia com frequência baixa por causa de março a
 * julho sem que nenhuma semana constasse como faltando.
 */
const countsForAttendance = (week: TimelineWeek): boolean =>
  !week.isException &&
  !week.isPending &&
  (week.expectedChildren > 0 || week.hasPagela);

/**
 * Consultas de frequência de clubinho.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas. Este bloco não compartilhava nada com o resto — nem os três
 * auxiliares de semana, nem o serviço de filtros — então é a fatia que sai
 * inteira sem tocar em nenhuma outra.
 *
 * Toda data aqui é texto `YYYY-MM-DD`, comparado como texto. A versão anterior
 * lia as datas com `new Date('YYYY-MM-DD')` — meia-noite UTC, que no Brasil é
 * a véspera — e o dia do clubinho saía um dia antes.
 */
@Injectable()
export class AttendanceStatisticsRepository {
  constructor(
    @InjectRepository(PagelaEntity)
    private readonly pagelasRepository: Repository<PagelaEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubsRepository: Repository<ClubEntity>,
    @InjectRepository(ClubPeriodEntity)
    private readonly periodsRepository: Repository<ClubPeriodEntity>,
    private readonly expectedChildrenRepository: ExpectedChildrenRepository,
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
      throw new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      );
    }

    const pageNum = page || 1;
    const limitNum = limit || DEFAULT_PAGE_SIZE;

    const academicPeriod = await this.periodsRepository.findOne({
      where: { year, isActive: true },
    });

    // Sem período letivo não existe semana a cobrar. A resposta diz isso com
    // todas as letras, em vez de devolver "0% de frequência" e um alerta
    // crítico para um ano em que ninguém devia pagela nenhuma.
    if (!academicPeriod) {
      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        period: {
          startDate: startDate || `${year}-01-01`,
          endDate: endDate || `${year}-12-31`,
          totalWeeks: 0,
          activeWeeks: 0,
          exceptionsCount: 0,
          hasAcademicPeriod: false,
        },
        attendance: {
          weeksWithPagela: 0,
          weeksExpected: 0,
          weeksMissing: 0,
          attendanceRate: 0,
          consecutiveWeeksPresent: 0,
          consecutiveWeeksMissing: 0,
        },
        alerts: [],
        timeline: [],
        timelinePagination: this.paginate(0, pageNum, limitNum),
        missingWeeks: [],
        missingWeeksPagination: this.paginate(
          0,
          pageNum,
          MISSING_WEEKS_PAGE_SIZE,
        ),
        note: `Período letivo de ${year} não cadastrado - não há semanas a analisar`,
      };
    }

    const periodStart = academicPeriod.startDate;
    const periodEnd = academicPeriod.endDate;

    const [children, exceptions, pagelas] = await Promise.all([
      // Ativas e inativas: quem saiu em novembro era esperada em março.
      this.expectedChildrenRepository.findChildren({ clubId }),
      this.expectedChildrenRepository.findExceptions(),
      this.pagelasRepository
        .createQueryBuilder('pagela')
        .leftJoin('pagela.child', 'child')
        .leftJoin('child.club', 'club')
        .where('club.id = :clubId', { clubId })
        .andWhere('club.isActive = :clubActive', { clubActive: true })
        .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
        .andWhere('pagela.year = :academicYear', {
          academicYear: academicPeriod.year,
        })
        .andWhere('pagela.referenceDate >= :startDate', {
          startDate: periodStart,
        })
        .andWhere('pagela.referenceDate <= :endDate', { endDate: periodEnd })
        .select('pagela.year', 'year')
        .addSelect('pagela.week', 'week')
        .addSelect('COUNT(pagela.id)', 'totalPagelas')
        .addSelect(
          "DATE_FORMAT(MIN(pagela.referenceDate), '%Y-%m-%d')",
          'firstDate',
        )
        .addSelect(
          'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
          'presentCount',
        )
        .groupBy('pagela.year')
        .addGroupBy('pagela.week')
        .orderBy('pagela.year', 'ASC')
        .addOrderBy('pagela.week', 'ASC')
        .getRawMany<PagelaAttendanceRaw>(),
    ]);

    const weeksWithPagela = new Map<number, PagelaAttendanceData>();
    pagelas.forEach((p) => {
      weeksWithPagela.set(parseInt(p.week), {
        year: parseInt(p.year),
        week: parseInt(p.week),
        totalPagelas: toCount(p.totalPagelas),
        firstDate: p.firstDate,
        presenceCount: toCount(p.presentCount),
      });
    });

    const today = todayInAppTimezone();
    const allWeeks: TimelineWeek[] = [];

    for (const week of listAcademicWeeks(academicPeriod)) {
      const clubDay = clubDayInWeek(week.weekStart, club.weekday);

      // O dia do clubinho cai fora do período (primeira ou última semana
      // cortada): ali não há encontro, e a semana não entra na linha do tempo.
      if (!clubDay || clubDay < periodStart || clubDay > periodEnd) continue;

      allWeeks.push({
        year: week.year,
        week: week.week,
        date: clubDay,
        hasPagela: weeksWithPagela.has(week.week),
        isException: isExceptionDay(clubDay, exceptions),
        isPending: clubDay >= today,
        expectedChildren: countEnrolledAt(children, clubDay),
        ...weeksWithPagela.get(week.week),
      });
    }

    const countedWeeks = allWeeks.filter(countsForAttendance);
    const missingWeeks: MissingWeek[] = countedWeeks
      .filter((week) => !week.hasPagela)
      .map((week) => ({
        year: week.year,
        week: week.week,
        expectedDate: week.date,
        expectedChildren: week.expectedChildren,
        weekRange: {
          start: week.date,
          end: addDaysToDateOnly(week.date, 6),
        },
        reason: 'no_pagela',
        severity: 'warning',
      }));

    const weeksExpected = countedWeeks.length;
    const weeksWithPagelaCount = weeksExpected - missingWeeks.length;
    const weeksMissingCount = missingWeeks.length;
    const attendanceRate = percentage(weeksWithPagelaCount, weeksExpected);

    let consecutivePresent = 0;
    let consecutiveMissing = 0;
    let currentConsecutivePresent = 0;
    let currentConsecutiveMissing = 0;

    // A sequência anda só pelas semanas que contam: uma semana sem criança
    // esperada não quebra nem alonga sequência nenhuma.
    countedWeeks.forEach((week) => {
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
        severity:
          weeksMissingCount > CRITICAL_MISSING_WEEKS ? 'critical' : 'warning',
        message: `Clubinho tem ${weeksMissingCount} semana(s) sem pagela`,
        weeksMissing: weeksMissingCount,
      });
    }

    // Só há taxa a criticar quando havia semana a cumprir: "0% de 0 semanas"
    // não é frequência baixa, é ausência de cobrança.
    if (weeksExpected > 0 && attendanceRate < LOW_WEEKLY_ATTENDANCE_THRESHOLD) {
      alerts.push({
        type: 'low_attendance',
        severity: 'critical',
        message: `Taxa de frequência muito baixa: ${attendanceRate.toFixed(1)}%`,
      });
    }

    if (consecutiveMissing >= CRITICAL_MISSING_WEEKS) {
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

    const timelineSkip = (pageNum - 1) * limitNum;
    const missingSkip = (pageNum - 1) * MISSING_WEEKS_PAGE_SIZE;

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
        hasAcademicPeriod: true,
      },
      attendance: {
        weeksWithPagela: weeksWithPagelaCount,
        weeksExpected,
        weeksMissing: weeksMissingCount,
        attendanceRate: roundToOneDecimal(attendanceRate),
        consecutiveWeeksPresent: consecutivePresent,
        consecutiveWeeksMissing: consecutiveMissing,
      },
      alerts,
      timeline: allWeeks.slice(timelineSkip, timelineSkip + limitNum),
      timelinePagination: this.paginate(allWeeks.length, pageNum, limitNum),
      missingWeeks: missingWeeks.slice(
        missingSkip,
        missingSkip + MISSING_WEEKS_PAGE_SIZE,
      ),
      missingWeeksPagination: this.paginate(
        missingWeeks.length,
        pageNum,
        MISSING_WEEKS_PAGE_SIZE,
      ),
    };
  }

  async analyzeWeeklyAttendance(
    year: number,
    week: number,
    page?: number,
    limit?: number,
  ): Promise<WeeklyAttendanceDto> {
    const emptySummary = {
      totalClubs: 0,
      clubsActive: 0,
      clubsWithPagela: 0,
      clubsMissing: 0,
      attendanceRate: 0,
    };
    const emptyPagination =
      page && limit ? { pagination: this.paginate(0, page, limit) } : {};

    const academicPeriod = await this.periodsRepository.findOne({
      where: { year, isActive: true },
    });

    if (!academicPeriod) {
      return {
        year,
        week,
        weekRange: { start: null, end: null },
        clubs: [],
        summary: emptySummary,
        ...emptyPagination,
        note: 'Período letivo não cadastrado - nenhum clube retornado',
      };
    }

    const targetWeek = listAcademicWeeks(academicPeriod).find(
      (candidate) => candidate.week === week,
    );
    const weekStart =
      targetWeek?.weekStart ??
      addDaysToDateOnly(mondayOf(academicPeriod.startDate), (week - 1) * 7);
    const weekRange = {
      start: weekStart,
      end: addDaysToDateOnly(weekStart, 6),
    };

    if (!targetWeek) {
      return {
        year,
        week,
        weekRange,
        clubs: [],
        summary: emptySummary,
        ...emptyPagination,
        period: {
          year: academicPeriod.year,
          startDate: academicPeriod.startDate,
          endDate: academicPeriod.endDate,
        },
        note: `Semana fora do período letivo (${formatDateOnlyPtBr(academicPeriod.startDate)} a ${formatDateOnlyPtBr(academicPeriod.endDate)}) - nenhum clube retornado`,
      };
    }

    const [clubs, pagelasInWeek, children, exceptions] = await Promise.all([
      this.clubsRepository
        .createQueryBuilder('club')
        .leftJoinAndSelect('club.address', 'address')
        .where('club.isActive = :isActive', { isActive: true })
        .orderBy('club.number', 'ASC')
        .getMany(),
      this.pagelasRepository
        .createQueryBuilder('pagela')
        .leftJoin('pagela.child', 'child')
        .leftJoin('child.club', 'club')
        .where('pagela.year = :year', { year })
        .andWhere('pagela.week = :week', { week })
        .andWhere('club.isActive = :clubActive', { clubActive: true })
        .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
        .select('club.id', 'clubId')
        .addSelect('COUNT(DISTINCT child.id)', 'totalPagelas')
        .groupBy('club.id')
        .getRawMany<{ clubId: string; totalPagelas: string }>(),
      // Ativas e inativas: a regra de matrícula na data decide quem conta.
      this.expectedChildrenRepository.findChildren({}),
      this.expectedChildrenRepository.findExceptions(),
    ]);

    const clubsWithPagela = new Map(
      pagelasInWeek.map((p) => [p.clubId, toCount(p.totalPagelas)]),
    );

    const today = todayInAppTimezone();

    const clubsAnalysis = clubs.map((club) => {
      const totalPagelas = clubsWithPagela.get(club.id) || 0;
      const expectedDate =
        clubDayInWeek(targetWeek.weekStart, club.weekday) ??
        targetWeek.weekStart;
      const isOutOfPeriod =
        expectedDate < academicPeriod.startDate ||
        expectedDate > academicPeriod.endDate;

      const expectedChildren = isOutOfPeriod
        ? 0
        : countEnrolledAt(
            children.filter((child) => child.clubId === club.id),
            expectedDate,
          );
      const hasPagela = totalPagelas > 0;

      // Declarado com o tipo do contrato: um estado novo aqui passa a exigir
      // que ele seja acrescentado à união que a tela recebe.
      let status: WeeklyClubStatus = 'missing';
      // O período abre ou fecha no meio da semana e o dia deste clubinho ficou
      // de fora: não havia encontro, então não há pagela faltando.
      if (isOutOfPeriod) status = 'out_of_period';
      else if (isExceptionDay(expectedDate, exceptions)) status = 'vacation';
      else if (expectedDate >= today) status = 'pending';
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
      EXPECTED_CLUB_STATUSES.includes(club.status),
    );
    const clubsActive = expectedClubs.length;
    const clubsWithPagelaCount = expectedClubs.filter(
      (c) => c.hasPagela,
    ).length;
    const clubsMissingCount = expectedClubs.filter(
      (club) => club.status === 'missing',
    ).length;

    const pageNum = page || 1;
    const limitNum = limit || DEFAULT_PAGE_SIZE;
    const skip = (pageNum - 1) * limitNum;

    return {
      year,
      week,
      weekRange,
      clubs: clubsAnalysis.slice(skip, skip + limitNum),
      pagination: this.paginate(clubsAnalysis.length, pageNum, limitNum),
      summary: {
        totalClubs: clubsActive,
        clubsActive,
        clubsWithPagela: clubsWithPagelaCount,
        clubsMissing: clubsMissingCount,
        attendanceRate: percentage(clubsWithPagelaCount, clubsActive),
      },
    };
  }

  /** Recorte de página no formato das rotas de frequência. */
  private paginate(
    total: number,
    page: number,
    limit: number,
  ): AttendancePaginationDto {
    const totalPages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
