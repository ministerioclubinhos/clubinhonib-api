import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubPeriodEntity } from '../entities/club-period.entity';
import { ClubExceptionEntity } from '../entities/club-exception.entity';
import { ClubControlLogEntity } from '../entities/club-control-log.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { PagelaEntity } from 'src/modules/pagelas/entities/pagela.entity';
import { ClubWeekCheckService } from '../services/club-week-check.service';
import { AcademicWeekService } from '../services/academic-week.service';
import { PagelaChildIdRaw } from '../dto/club-control-raw.dto';
import { ClubCheckResultDto } from '../dto/club-check-result.dto';
import { DetailedIndicatorsResultDto } from '../dto/detailed-indicators-result.dto';
import {
  ClubIndicatorDetailDto,
  WeekdayStatsDto,
} from '../dto/detailed-indicators-helpers.dto';
import { DeepPartial, FindOptionsWhere } from 'typeorm';

@Injectable()
export class ClubControlRepository {
  constructor(
    @InjectRepository(ClubPeriodEntity)
    private readonly periodsRepository: Repository<ClubPeriodEntity>,
    @InjectRepository(ClubExceptionEntity)
    private readonly exceptionsRepository: Repository<ClubExceptionEntity>,
    @InjectRepository(ClubControlLogEntity)
    private readonly logsRepository: Repository<ClubControlLogEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubsRepository: Repository<ClubEntity>,
    @InjectRepository(ChildEntity)
    private readonly childrenRepository: Repository<ChildEntity>,
    @InjectRepository(PagelaEntity)
    private readonly pagelasRepository: Repository<PagelaEntity>,
    @Inject(forwardRef(() => ClubWeekCheckService))
    private readonly clubWeekCheckService: ClubWeekCheckService,
    @Inject(forwardRef(() => AcademicWeekService))
    private readonly academicWeekService: AcademicWeekService,
  ) {}

  async createPeriod(
    data: DeepPartial<ClubPeriodEntity>,
  ): Promise<ClubPeriodEntity> {
    const period = this.periodsRepository.create(data);
    return this.periodsRepository.save(period);
  }

  async findPeriodByYear(year: number): Promise<ClubPeriodEntity | null> {
    return this.periodsRepository.findOne({
      where: { year, isActive: true },
    });
  }

  async findAnyPeriodByYear(year: number): Promise<ClubPeriodEntity | null> {
    return this.periodsRepository.findOne({
      where: { year },
      withDeleted: false,
    });
  }

  async findPeriodById(id: string): Promise<ClubPeriodEntity | null> {
    return this.periodsRepository.findOne({
      where: { id },
    });
  }

  async findAllPeriods(
    page?: number,
    limit?: number,
  ): Promise<{ items: ClubPeriodEntity[]; total: number }> {
    const where: FindOptionsWhere<ClubPeriodEntity> = { isActive: true };
    const total = await this.periodsRepository.count({ where });
    let items: ClubPeriodEntity[];
    if (page && limit) {
      const skip = (page - 1) * limit;
      items = await this.periodsRepository.find({
        where,
        order: { year: 'DESC' },
        skip,
        take: limit,
      });
    } else {
      items = await this.periodsRepository.find({
        where,
        order: { year: 'DESC' },
      });
    }
    return { items, total };
  }

  async savePeriod(entity: ClubPeriodEntity): Promise<ClubPeriodEntity> {
    return this.periodsRepository.save(entity);
  }

  async deletePeriod(id: string): Promise<{ success: boolean }> {
    const existing = await this.periodsRepository.findOne({ where: { id } });
    if (!existing) {
      return { success: false };
    }
    if (existing.isActive === false) {
      return { success: true };
    }
    existing.isActive = false;
    await this.periodsRepository.save(existing);
    return { success: true };
  }

  async createException(
    data: DeepPartial<ClubExceptionEntity>,
  ): Promise<ClubExceptionEntity> {
    const exception = this.exceptionsRepository.create(data);
    return this.exceptionsRepository.save(exception);
  }

  async findExceptionByDate(date: string): Promise<ClubExceptionEntity | null> {
    return this.exceptionsRepository.findOne({
      where: { exceptionDate: date, isActive: true },
    });
  }

  async findExceptionsByPeriod(
    startDate?: string,
    endDate?: string,
    page?: number,
    limit?: number,
  ): Promise<{ items: ClubExceptionEntity[]; total: number }> {
    const query = this.exceptionsRepository
      .createQueryBuilder('exception')
      .where('exception.isActive = :isActive', { isActive: true });

    if (startDate) {
      query.andWhere('exception.exceptionDate >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('exception.exceptionDate <= :endDate', { endDate });
    }

    const total = await query.getCount();

    if (page && limit) {
      const skip = (page - 1) * limit;
      query.skip(skip).take(limit);
    }

    const items = await query
      .orderBy('exception.exceptionDate', 'ASC')
      .getMany();
    return { items, total };
  }

  async deleteException(id: string): Promise<{ success: boolean }> {
    const existing = await this.exceptionsRepository.findOne({ where: { id } });
    if (!existing) {
      return { success: false };
    }
    if (existing.isActive === false) {
      return { success: true };
    }
    existing.isActive = false;
    await this.exceptionsRepository.save(existing);
    return { success: true };
  }

  async findClubById(clubId: string): Promise<ClubEntity | null> {
    return this.clubsRepository.findOne({
      where: { id: clubId },
    });
  }

  async findAllChildrenByClubId(clubId: string): Promise<ChildEntity[]> {
    return this.childrenRepository.find({
      where: { club: { id: clubId } },
    });
  }

  async getChildrenWithPagela(
    clubId: string,
    year: number,
    week: number,
    childIds: string[],
  ): Promise<string[]> {
    if (childIds.length === 0) return [];

    const pagelas = await this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.id = :clubId', { clubId })
      .andWhere('pagela.year = :year', { year })
      .andWhere('pagela.week = :week', { week })
      .andWhere('child.id IN (:...childIds)', { childIds })
      .select('DISTINCT child.id', 'childId')
      .getRawMany<PagelaChildIdRaw>();

    return pagelas.map((p) => p.childId);
  }

  async countPagelasForChildren(
    clubId: string,
    year: number,
    week: number,
    childIds: string[],
  ): Promise<number> {
    if (childIds.length === 0) return 0;

    return this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.id = :clubId', { clubId })
      .andWhere('pagela.year = :year', { year })
      .andWhere('pagela.week = :week', { week })
      .andWhere('child.id IN (:...childIds)', { childIds })
      .getCount();
  }

  async findAllClubs(): Promise<ClubEntity[]> {
    return this.clubsRepository.find();
  }
  async getDetailedIndicators(
    year: number,
    week: number,
    filters?: {
      status?: string;
      severity?: string;
      weekday?: string;
      indicatorType?: string;
      hasProblems?: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<DetailedIndicatorsResultDto> {
    const allClubs = await this.clubsRepository.find();
    const activeClubs = allClubs.filter((c) => c.isActive === true);
    const inactiveClubs = allClubs.filter((c) => c.isActive === false);

    let clubsResults: ClubCheckResultDto[] = await Promise.all(
      activeClubs.map((club) =>
        this.clubWeekCheckService.checkClubWeek(club.id, year, week),
      ),
    );

    const inactiveClubsResults: ClubCheckResultDto[] = await Promise.all(
      inactiveClubs.map((club) =>
        this.clubWeekCheckService.checkClubWeek(club.id, year, week),
      ),
    );

    let totalChildrenNotAttending = 0;
    const childrenNotAttendingList: any[] = [];

    clubsResults.forEach((result) => {
      if (result.children.notAttendingCount > 0) {
        totalChildrenNotAttending += result.children.notAttendingCount;
        childrenNotAttendingList.push(
          ...(result.children.notAttendingList || []),
        );
      }
    });

    inactiveClubsResults.forEach((result) => {
      if (result.children.notAttendingCount > 0) {
        totalChildrenNotAttending += result.children.notAttendingCount;
        childrenNotAttendingList.push(
          ...(result.children.notAttendingList || []),
        );
      }
    });

    if (filters) {
      if (filters.status) {
        clubsResults = clubsResults.filter((r) => r.status === filters.status);
      }

      if (filters.weekday) {
        clubsResults = clubsResults.filter(
          (r) => r.weekday?.toLowerCase() === filters.weekday?.toLowerCase(),
        );
      }

      if (filters.hasProblems !== undefined) {
        if (filters.hasProblems) {
          clubsResults = clubsResults.filter((r) => {
            const hasCritical = r.indicators?.some(
              (i) => i.severity === 'critical',
            );
            const hasWarning = r.indicators?.some(
              (i) => i.severity === 'warning',
            );
            return (
              hasCritical ||
              hasWarning ||
              r.status === 'partial' ||
              r.status === 'missing'
            );
          });
        } else {
          clubsResults = clubsResults.filter((r) => r.status === 'ok');
        }
      }

      if (filters.severity) {
        clubsResults = clubsResults.filter((r) =>
          r.indicators?.some((i) => i.severity === filters.severity),
        );
      }

      if (filters.indicatorType) {
        clubsResults = clubsResults.filter((r) =>
          r.indicators?.some((i) => i.type === filters.indicatorType),
        );
      }
    }

    const statsByWeekday: Record<string, WeekdayStatsDto> = {};
    const indicatorsByType: Record<string, ClubIndicatorDetailDto[]> = {
      children_not_attending: [],
      exception: [],
      all_ok: [],
      some_missing: [],
      no_pagela: [],
      no_children: [],
      no_weekday: [],
      out_of_period: [],
      club_inactive: [],
    };

    const clubsByStatus: Record<string, ClubCheckResultDto[]> = {
      ok: [],
      pending: [],
      partial: [],
      missing: [],
      exception: [],
      inactive: [],
      out_of_period: [],
    };

    let totalChildrenAll = 0;
    let totalChildrenWithPagela = 0;
    let totalChildrenMissing = 0;
    const clubsWithProblems: ClubCheckResultDto[] = [];
    const clubsCritical: ClubCheckResultDto[] = [];
    const clubsWarning: ClubCheckResultDto[] = [];

    clubsResults.forEach((result) => {
      if (!clubsByStatus[result.status]) {
        clubsByStatus[result.status] = [];
      }
      clubsByStatus[result.status].push(result);

      if (result.indicators && result.indicators.length > 0) {
        result.indicators.forEach((indicator) => {
          const type = indicator.type;
          if (indicatorsByType[type]) {
            indicatorsByType[type].push({
              clubId: result.clubId,
              clubNumber: result.clubNumber,
              weekday: result.weekday!,
              indicator,
              children: result.children,
              week: result.week,
            });
          }
        });

        const hasCritical = result.indicators.some(
          (i) => i.severity === 'critical',
        );
        const hasWarning = result.indicators.some(
          (i) => i.severity === 'warning',
        );

        if (hasCritical) {
          clubsCritical.push(result);
          clubsWithProblems.push(result);
        } else if (hasWarning) {
          clubsWarning.push(result);
          clubsWithProblems.push(result);
        }
      }

      totalChildrenAll += result.children.total || 0;
      totalChildrenWithPagela += result.children.withPagela || 0;
      totalChildrenMissing += result.children.missing || 0;
    });

    const overallCompletionRate =
      totalChildrenAll > 0
        ? (totalChildrenWithPagela / totalChildrenAll) * 100
        : 0;
    const overallMissingRate =
      totalChildrenAll > 0
        ? (totalChildrenMissing / totalChildrenAll) * 100
        : 0;

    clubsResults.forEach((result) => {
      if (result.weekday) {
        if (!statsByWeekday[result.weekday]) {
          statsByWeekday[result.weekday] = {
            weekday: result.weekday,
            totalClubs: 0,
            clubsOk: 0,
            clubsPending: 0,
            clubsPartial: 0,
            clubsMissing: 0,
            totalChildren: 0,
            childrenWithPagela: 0,
            childrenMissing: 0,
            completionRate: 0,
          };
        }

        const stats = statsByWeekday[result.weekday];
        stats.totalClubs++;
        if (result.status === 'ok') stats.clubsOk++;
        if (result.status === 'pending')
          stats.clubsPending = (stats.clubsPending || 0) + 1;
        if (result.status === 'partial') stats.clubsPartial++;
        if (result.status === 'missing') stats.clubsMissing++;
        stats.totalChildren += result.children.total || 0;
        stats.childrenWithPagela += result.children.withPagela || 0;
        stats.childrenMissing += result.children.missing || 0;
        stats.completionRate =
          stats.totalChildren > 0
            ? (stats.childrenWithPagela / stats.totalChildren) * 100
            : 0;
      }
    });

    const recommendations: string[] = [];

    if (clubsCritical.length > 0) {
      recommendations.push(
        `🚨 ATENÇÃO: ${clubsCritical.length} clube(s) com problemas críticos precisam de atenção imediata`,
      );
    }

    if (clubsWarning.length > 0) {
      recommendations.push(
        `⚠️ ${clubsWarning.length} clube(s) com avisos requerem atenção`,
      );
    }

    if (overallMissingRate > 20) {
      recommendations.push(
        `📊 Taxa de faltantes alta (${Math.round(overallMissingRate)}%). Considere verificar as causas`,
      );
    }

    if (indicatorsByType.no_pagela.length > 0) {
      recommendations.push(
        `🔴 ${indicatorsByType.no_pagela.length} clube(s) sem nenhuma pagela registrada nesta semana`,
      );
    }

    if (indicatorsByType.some_missing.length > 0) {
      recommendations.push(
        `⚠️ ${indicatorsByType.some_missing.length} clube(s) com pagelas parciais - algumas crianças faltando`,
      );
    }

    const executiveSummary = {
      week: {
        year,
        week,
        expectedDate: clubsResults[0]?.week?.expectedDate || null,
      },
      overall: {
        totalClubs: activeClubs.length,
        totalClubsInactive: inactiveClubs.length,
        clubsOk: clubsByStatus.ok?.length || 0,
        clubsPending: clubsByStatus.pending?.length || 0,
        clubsPartial: clubsByStatus.partial?.length || 0,
        clubsMissing: clubsByStatus.missing?.length || 0,
        clubsException: clubsByStatus.exception?.length || 0,
        clubsInactive: clubsByStatus.inactive?.length || 0,
        clubsOutOfPeriod: clubsByStatus.out_of_period?.length || 0,
        clubsWithProblems: clubsWithProblems.length,
        clubsCritical: clubsCritical.length,
        clubsWarning: clubsWarning.length,
      },
      children: {
        total: totalChildrenAll,
        withPagela: totalChildrenWithPagela,
        missing: totalChildrenMissing,
        completionRate: Math.round(overallCompletionRate * 10) / 10,
        missingRate: Math.round(overallMissingRate * 10) / 10,

        notAttending: {
          total: totalChildrenNotAttending,
          fromInactiveClubs: inactiveClubsResults.reduce(
            (sum, r) => sum + (r.children.notAttendingCount || 0),
            0,
          ),
          fromInactiveChildren: clubsResults.reduce(
            (sum, r) => sum + (r.children.notAttendingCount || 0),
            0,
          ),
        },
      },
      indicators: {
        total: clubsResults.reduce(
          (sum, r) => sum + (r.indicators?.length || 0),
          0,
        ),
        byType: Object.keys(indicatorsByType).reduce(
          (acc, key) => {
            acc[key] = indicatorsByType[key].length;
            return acc;
          },
          {} as Record<string, number>,
        ),
        bySeverity: {
          critical: clubsResults.filter((r) =>
            r.indicators?.some((i) => i.severity === 'critical'),
          ).length,
          warning: clubsResults.filter((r) =>
            r.indicators?.some((i) => i.severity === 'warning'),
          ).length,
          info: clubsResults.filter((r) =>
            r.indicators?.some((i) => i.severity === 'info'),
          ).length,
          success: clubsResults.filter((r) =>
            r.indicators?.some((i) => i.severity === 'success'),
          ).length,
        },
      },
    };

    return {
      executiveSummary,
      indicators: {
        byType: indicatorsByType,
        critical: indicatorsByType.no_pagela.map((item) => ({
          clubId: item.clubId,
          clubNumber: item.clubNumber,
          weekday: item.weekday,
          indicator: item.indicator,
          children: item.children,
        })),
        warning: [
          ...indicatorsByType.some_missing,
          ...indicatorsByType.no_children,
        ].map((item) => ({
          clubId: item.clubId,
          clubNumber: item.clubNumber,
          weekday: item.weekday,
          indicator: item.indicator,
          children: item.children,
        })),
      },
      clubs: {
        byStatus: clubsByStatus,
        withProblems: clubsWithProblems,
        critical: clubsCritical,
        warning: clubsWarning,
      },
      statistics: {
        byWeekday: Object.values(statsByWeekday),
        overall: {
          completionRate: Math.round(overallCompletionRate * 10) / 10,
          missingRate: Math.round(overallMissingRate * 10) / 10,
          problemsRate:
            activeClubs.length > 0
              ? Math.round(
                  (clubsWithProblems.length / activeClubs.length) * 100 * 10,
                ) / 10
              : 0,
        },
      },
      recommendations,
      currentWeek:
        await this.academicWeekService.calculateCurrentAcademicWeek(),

      inactiveClubs: inactiveClubs.map((club) => ({
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        isActive: club.isActive,
      })),
      childrenNotAttending: {
        total: totalChildrenNotAttending,
        list: childrenNotAttendingList,
      },

      ...(filters?.page && filters?.limit
        ? {
            pagination: {
              page: filters.page,
              limit: filters.limit,
              total: clubsWithProblems.length,
              totalPages: Math.ceil(clubsWithProblems.length / filters.limit),
              hasNextPage:
                filters.page * filters.limit < clubsWithProblems.length,
              hasPreviousPage: filters.page > 1,
            },
            clubsWithProblems: clubsWithProblems.slice(
              (filters.page - 1) * filters.limit,
              filters.page * filters.limit,
            ),
            clubsCritical: clubsCritical.slice(
              (filters.page - 1) * filters.limit,
              filters.page * filters.limit,
            ),
          }
        : {}),
    };
  }

  private getWeekStartDate(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  private getExpectedDateForAcademicWeek(
    year: number,
    week: number,
    weekday: string,
    period: ClubPeriodEntity,
  ): string {
    const weekdayMap: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
    };

    const targetWeekday = weekdayMap[weekday?.toLowerCase()];

    if (targetWeekday === undefined) {
      throw new Error(`Invalid weekday: ${weekday}`);
    }

    const periodStartDate = new Date(period.startDate + 'T00:00:00');
    const startWeekStart = this.getWeekStartDate(periodStartDate);

    const academicWeekStart = new Date(startWeekStart);
    academicWeekStart.setDate(startWeekStart.getDate() + (week - 1) * 7);

    const date = new Date(academicWeekStart);
    const currentDay = date.getDay();

    let dayDiff = targetWeekday - currentDay;
    if (dayDiff < 0) {
      dayDiff += 7;
    }

    date.setDate(academicWeekStart.getDate() + dayDiff);

    const resultDate = date.toISOString().split('T')[0];

    return resultDate;
  }

  private getExpectedDateForWeek(
    year: number,
    week: number,
    weekday: string,
  ): string {
    const weekdayMap: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
    };

    const targetWeekday = weekdayMap[weekday?.toLowerCase()];

    if (targetWeekday === undefined) {
      throw new Error(`Invalid weekday: ${weekday}`);
    }

    const date = this.getDateOfISOWeek(year, week);

    let iterations = 0;
    while (date.getDay() !== targetWeekday && iterations < 7) {
      date.setDate(date.getDate() + 1);
      iterations++;
    }

    if (iterations === 7) {
      throw new Error(
        `Could not calculate date for year=${year}, week=${week}, weekday=${weekday}`,
      );
    }

    return date.toISOString().split('T')[0];
  }

  private getDateOfISOWeek(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  }
}
