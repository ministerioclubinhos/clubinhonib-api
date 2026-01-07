import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { ClubPeriodEntity } from '../entities/club-period.entity';
import { ClubExceptionEntity } from '../entities/club-exception.entity';
import { ClubControlRepository } from '../repositories/club-control.repository';
import { AcademicWeekService } from './academic-week.service';
import { ClubStatusService } from './club-status.service';
import { ClubIndicatorsService } from './club-indicators.service';

@Injectable()
export class ClubWeekCheckService {
  constructor(
    @Inject(forwardRef(() => ClubControlRepository))
    private readonly clubControlRepository: ClubControlRepository,
    private readonly academicWeekService: AcademicWeekService,
    private readonly clubStatusService: ClubStatusService,
    private readonly clubIndicatorsService: ClubIndicatorsService,
  ) {}

  async checkClubWeek(
    clubId: string,
    year: number,
    week: number,
  ): Promise<any> {
    const club = await this.clubControlRepository.findClubById(clubId);

    if (!club) {
      throw new Error('Clubinho not found');
    }

    const period = await this.clubControlRepository.findPeriodByYear(year);

    if (period) {
      const maxAcademicWeek =
        this.academicWeekService.calculateMaxAcademicWeek(period);
      if (week > maxAcademicWeek) {
        return this.buildOutOfPeriodResponse(
          club,
          year,
          week,
          period,
          maxAcademicWeek,
        );
      }
    }

    const expectedDate =
      club.weekday && period
        ? this.academicWeekService.getExpectedDateForAcademicWeek(
            year,
            week,
            club.weekday,
            period,
          )
        : null;

    const allChildren =
      await this.clubControlRepository.findAllChildrenByClubId(clubId);

    if (club.isActive === false) {
      return this.buildInactiveClubResponse(
        club,
        year,
        week,
        expectedDate,
        allChildren,
      );
    }

    const expectedDateObj = expectedDate ? new Date(expectedDate) : null;
    const { activeChildren, inactiveChildren } =
      this.separateActiveInactiveChildren(allChildren, expectedDateObj);

    const totalChildren = activeChildren.length;
    const inactiveCount = inactiveChildren.length;

    const childrenWithPagelaIds =
      await this.clubControlRepository.getChildrenWithPagela(
        clubId,
        year,
        week,
        activeChildren.map((c) => c.id),
      );

    const childrenWithPagela = childrenWithPagelaIds.length;
    const childrenMissing = totalChildren - childrenWithPagela;
    const childrenMissingList = activeChildren
      .filter((c) => !childrenWithPagelaIds.includes(c.id))
      .map((c) => ({
        childId: c.id,
        childName: c.name,
      }));

    if (!club.weekday) {
      return this.buildNoWeekdayResponse(
        club,
        year,
        week,
        totalChildren,
        childrenWithPagela,
        childrenMissing,
        childrenMissingList,
      );
    }

    if (!period) {
      return this.buildNoPeriodResponse(
        club,
        year,
        week,
        expectedDate,
        totalChildren,
        inactiveCount,
        allChildren,
        childrenWithPagela,
        childrenMissing,
        childrenMissingList,
      );
    }

    if (!expectedDate) {
      return this.buildNoPeriodResponse(
        club,
        year,
        week,
        expectedDate,
        totalChildren,
        inactiveCount,
        allChildren,
        childrenWithPagela,
        childrenMissing,
        childrenMissingList,
      );
    }

    const isWithinPeriod = this.academicWeekService.isExpectedDateWithinPeriod(
      expectedDate,
      period,
    );

    if (!isWithinPeriod) {
      return this.buildOutOfPeriodDateResponse(
        club,
        year,
        week,
        expectedDate,
        period,
        totalChildren,
        inactiveCount,
        allChildren,
        childrenWithPagela,
        childrenMissing,
        childrenMissingList,
      );
    }

    const exception =
      await this.clubControlRepository.findExceptionByDate(expectedDate);

    const weekType = await this.academicWeekService.getWeekType(year, week);

    const hasPassedClubDay = this.academicWeekService.hasPassedClubDay(
      expectedDate,
      weekType.isCurrent,
      weekType.isFuture,
    );

    const status = this.clubStatusService.determineStatus(
      !!exception,
      weekType.isFuture,
      hasPassedClubDay,
      weekType.isCurrent,
      childrenWithPagela,
      totalChildren,
    );

    const completionRate =
      totalChildren > 0 ? (childrenWithPagela / totalChildren) * 100 : 0;
    const missingRate =
      totalChildren > 0 ? (childrenMissing / totalChildren) * 100 : 0;

    const indicators = this.clubIndicatorsService.generateIndicators(
      status,
      !!exception,
      exception,
      hasPassedClubDay,
      totalChildren,
      childrenWithPagela,
      childrenMissing,
      inactiveChildren,
      completionRate,
      missingRate,
    );

    return {
      clubId: club.id,
      clubNumber: club.number,
      weekday: club.weekday,
      week: {
        year,
        week,
        expectedDate,
      },
      children: {
        total: totalChildren,
        activeCount: totalChildren,
        inactiveCount: inactiveCount,
        withPagela: childrenWithPagela,
        missing: childrenMissing,
        missingList: childrenMissingList,
        notAttendingCount: inactiveChildren.length,
        notAttendingList: inactiveChildren.map((c) => ({
          childId: c.id,
          childName: c.name,
          isActive: c.isActive,
        })),
        note: "Apenas crianças ATIVAS e que já tinham entrado são consideradas nos indicadores normais. Crianças inativas entram apenas no indicador de 'não frequentam mais'",
      },
      status,
      indicators,
      exception: exception
        ? {
            date: exception.exceptionDate,
            reason: exception.reason,
            type: exception.type,
          }
        : null,
    };
  }

  private separateActiveInactiveChildren(
    allChildren: ChildEntity[],
    expectedDateObj: Date | null,
  ): { activeChildren: ChildEntity[]; inactiveChildren: ChildEntity[] } {
    const activeChildren = allChildren.filter((child) => {
      if (child.isActive === false) return false;
      if (child.joinedAt && expectedDateObj) {
        const joinedDate = new Date(child.joinedAt);
        return joinedDate <= expectedDateObj;
      }
      return true;
    });

    const inactiveChildren = allChildren.filter((child) => {
      if (child.isActive !== false) return false;
      if (child.joinedAt && expectedDateObj) {
        const joinedDate = new Date(child.joinedAt);
        return joinedDate <= expectedDateObj;
      }
      return true;
    });

    return { activeChildren, inactiveChildren };
  }

  private buildOutOfPeriodResponse(
    club: ClubEntity,
    year: number,
    week: number,
    period: ClubPeriodEntity,
    maxAcademicWeek: number,
  ) {
    return {
      clubId: club.id,
      clubNumber: club.number,
      weekday: club.weekday,
      week: { year, week, expectedDate: null },
      children: {
        total: 0,
        activeCount: 0,
        inactiveCount: 0,
        withPagela: 0,
        missing: 0,
        missingList: [],
        notAttendingCount: 0,
        notAttendingList: [],
        note: 'Apenas crianças ATIVAS e que já tinham entrado são consideradas nos indicadores normais',
      },
      status: 'out_of_period',
      indicators: [],
      exception: null,
      period: {
        year: period.year,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      note: `Semana ${week} está fora do período letivo (período tem ${maxAcademicWeek} semanas) - indicadores não são gerados`,
    };
  }

  private buildInactiveClubResponse(
    club: ClubEntity,
    year: number,
    week: number,
    expectedDate: string | null,
    allChildren: ChildEntity[],
  ) {
    const expectedDateObj = expectedDate ? new Date(expectedDate) : null;
    const childrenNotAttending = allChildren.filter((child) => {
      if (child.joinedAt && expectedDateObj) {
        const joinedDate = new Date(child.joinedAt);
        return joinedDate <= expectedDateObj;
      }
      return true;
    });

    const indicators =
      this.clubIndicatorsService.generateInactiveClubIndicators(
        allChildren,
        childrenNotAttending,
      );

    return {
      clubId: club.id,
      clubNumber: club.number,
      weekday: club.weekday,
      week: { year, week, expectedDate },
      children: {
        total: 0,
        activeCount: 0,
        inactiveCount: allChildren.length,
        withPagela: 0,
        missing: 0,
        missingList: [],
        notAttendingCount: childrenNotAttending.length,
        notAttendingList: childrenNotAttending.map((c) => ({
          childId: c.id,
          childName: c.name,
          isActive: c.isActive,
        })),
        note: "Clubinho desativado - todas as crianças entram no indicador de 'não frequentam mais'",
      },
      status: 'inactive',
      indicators,
      exception: null,
    };
  }

  private buildNoWeekdayResponse(
    club: ClubEntity,
    year: number,
    week: number,
    totalChildren: number,
    childrenWithPagelaCount: number,
    childrenMissing: number,
    childrenMissingList: any[],
  ) {
    return {
      clubId: club.id,
      clubNumber: club.number,
      weekday: null,
      week: { year, week, expectedDate: null },
      children: {
        total: totalChildren,
        activeCount: totalChildren,
        inactiveCount: 0,
        withPagela: childrenWithPagelaCount,
        missing: childrenMissing,
        missingList: childrenMissingList,
        notAttendingCount: 0,
        notAttendingList: [],
        note: 'Apenas crianças ATIVAS e que já tinham entrado são consideradas nos indicadores normais',
      },
      status: 'inactive',
      indicators: [
        {
          type: 'no_weekday',
          severity: 'info',
          message: `ℹ️ Clubinho sem dia da semana definido (provavelmente inativo)`,
        },
      ],
      exception: null,
    };
  }

  private buildNoPeriodResponse(
    club: ClubEntity,
    year: number,
    week: number,
    expectedDate: string | null,
    totalChildren: number,
    inactiveCount: number,
    allChildren: ChildEntity[],
    childrenWithPagela: number,
    childrenMissing: number,
    childrenMissingList: any[],
  ) {
    return {
      clubId: club.id,
      clubNumber: club.number,
      weekday: club.weekday,
      week: { year, week, expectedDate },
      children: {
        total: totalChildren,
        activeCount: totalChildren,
        inactiveCount: inactiveCount,
        withPagela: childrenWithPagela,
        missing: childrenMissing,
        missingList: childrenMissingList,
        notAttendingCount: inactiveCount,
        notAttendingList:
          inactiveCount > 0
            ? allChildren
                .filter((c) => c.isActive === false)
                .map((c) => ({
                  childId: c.id,
                  childName: c.name,
                  isActive: c.isActive,
                }))
            : [],
        note: 'Apenas crianças ATIVAS e que já tinham entrado são consideradas nos indicadores normais',
      },
      status: 'ok',
      indicators: [],
      exception: null,
      note: 'Período letivo não cadastrado - indicadores não são gerados',
    };
  }

  private buildOutOfPeriodDateResponse(
    club: ClubEntity,
    year: number,
    week: number,
    expectedDate: string,
    period: ClubPeriodEntity,
    totalChildren: number,
    inactiveCount: number,
    allChildren: ChildEntity[],
    childrenWithPagela: number,
    childrenMissing: number,
    childrenMissingList: any[],
  ) {
    return {
      clubId: club.id,
      clubNumber: club.number,
      weekday: club.weekday,
      week: { year, week, expectedDate },
      children: {
        total: totalChildren,
        activeCount: totalChildren,
        inactiveCount: inactiveCount,
        withPagela: childrenWithPagela,
        missing: childrenMissing,
        missingList: childrenMissingList,
        notAttendingCount: inactiveCount,
        notAttendingList:
          inactiveCount > 0
            ? allChildren
                .filter((c) => c.isActive === false)
                .map((c) => ({
                  childId: c.id,
                  childName: c.name,
                  isActive: c.isActive,
                }))
            : [],
        note: 'Apenas crianças ATIVAS e que já tinham entrado são consideradas nos indicadores normais',
      },
      status: 'out_of_period',
      indicators: [],
      exception: null,
      period: {
        year: period.year,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      note: 'Fora do período letivo - indicadores não são gerados',
    };
  }
}
