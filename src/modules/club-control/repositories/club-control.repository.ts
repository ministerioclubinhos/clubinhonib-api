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

  async createPeriod(data: any): Promise<ClubPeriodEntity> {
    const period = this.periodsRepository.create(data);
    return (await this.periodsRepository.save(
      period,
    )) as unknown as ClubPeriodEntity;
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
    const where = { isActive: true } as any;
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

  async createException(data: any): Promise<ClubExceptionEntity> {
    const exception = this.exceptionsRepository.create(data);
    return (await this.exceptionsRepository.save(
      exception,
    )) as unknown as ClubExceptionEntity;
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
      .getRawMany();

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

  async findMissingChildrenList(
    clubId: string,
    year: number,
    week: number,
    activeChildren: ChildEntity[],
    childrenWithPagelaIds: string[],
  ): Promise<Array<{ childId: string; childName: string }>> {
    return activeChildren
      .filter((c) => !childrenWithPagelaIds.includes(c.id))
      .map((c) => ({
        childId: c.id,
        childName: c.name,
      }));
  }

  async findAllClubs(): Promise<ClubEntity[]> {
    return this.clubsRepository.find();
  }

  async checkClubWeek(
    clubId: string,
    year: number,
    week: number,
    includeCurrentWeek?: boolean,
  ): Promise<any> {
    throw new Error(
      'checkClubWeek foi movido para ClubWeekCheckService. Use o service ao invés do repository.',
    );
  }

  private async _oldCheckClubWeek(
    clubId: string,
    year: number,
    week: number,
  ): Promise<any> {
    const club = await this.clubsRepository.findOne({
      where: { id: clubId },
    });

    if (!club) {
      throw new Error('Clubinho not found');
    }

    const period = await this.findPeriodByYear(year);

    let maxAcademicWeek = 0;
    if (period) {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);

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

    if (period && maxAcademicWeek > 0 && week > maxAcademicWeek) {
      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        week: {
          year,
          week,
          expectedDate: null,
        },
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

    const expectedDate =
      club.weekday && period
        ? this.getExpectedDateForAcademicWeek(year, week, club.weekday, period)
        : null;

    const allChildren = await this.childrenRepository.find({
      where: { club: { id: clubId } },
    });

    if (club.isActive === false) {
      const expectedDateObj = expectedDate ? new Date(expectedDate) : null;
      const childrenNotAttending = allChildren.filter((child) => {
        if (child.joinedAt && expectedDateObj) {
          const joinedDate = new Date(child.joinedAt);
          return joinedDate <= expectedDateObj;
        }
        return true;
      });

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
        indicators: [
          {
            type: 'club_inactive',
            severity: 'info',
            message: `ℹ️ Clubinho desativado`,
            details: {
              totalChildren: allChildren.length,
              childrenNotAttending: childrenNotAttending.length,
              note: 'Todas as crianças deste clubinho (ativas e inativas) entram no indicador de "crianças que não frequentam mais os clubinhos"',
            },
          },
          {
            type: 'children_not_attending',
            severity: 'warning',
            message: `⚠️ ${childrenNotAttending.length} criança(s) que não frequentam mais os clubinhos`,
            details: {
              totalChildren: childrenNotAttending.length,
              childrenList: childrenNotAttending.map((c) => ({
                childId: c.id,
                childName: c.name,
                isActive: c.isActive,
                reason: 'Clubinho desativado',
              })),
              note: 'Todas as crianças deste clubinho desativado são consideradas como não frequentando mais',
            },
          },
        ],
        exception: null,
      };
    }

    const expectedDateObj = expectedDate ? new Date(expectedDate) : null;

    const activeChildren = allChildren.filter((child) => {
      if (child.isActive === false) {
        return false;
      }

      if (child.joinedAt && expectedDateObj) {
        const joinedDate = new Date(child.joinedAt);

        return joinedDate <= expectedDateObj;
      }

      return true;
    });

    const inactiveChildren = allChildren.filter((child) => {
      if (child.isActive !== false) {
        return false;
      }

      if (child.joinedAt && expectedDateObj) {
        const joinedDate = new Date(child.joinedAt);
        return joinedDate <= expectedDateObj;
      }

      return true;
    });

    const totalChildren = activeChildren.length;
    const inactiveCount = inactiveChildren.length;

    const childIds = activeChildren.map((c) => c.id);
    const pagelas =
      childIds.length > 0
        ? await this.pagelasRepository
            .createQueryBuilder('pagela')
            .leftJoin('pagela.child', 'child')
            .leftJoin('child.club', 'club')
            .where('club.id = :clubId', { clubId })
            .andWhere('club.isActive = :clubActive', { clubActive: true })
            .andWhere('pagela.year = :year', { year })
            .andWhere('pagela.week = :week', { week })
            .andWhere('child.id IN (:...childIds)', { childIds })
            .select('DISTINCT child.id', 'childId')
            .getRawMany()
        : [];

    const childrenWithPagela = pagelas.length;
    const childrenMissing = totalChildren - childrenWithPagela;

    const childIdsWithPagela = pagelas.map((p) => p.childId);
    const childrenMissingList = activeChildren
      .filter((c) => !childIdsWithPagela.includes(c.id))
      .map((c) => ({
        childId: c.id,
        childName: c.name,
      }));

    if (!club.weekday) {
      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: null,
        week: {
          year,
          week,
          expectedDate: null,
        },
        children: {
          total: totalChildren,
          activeCount: totalChildren,
          inactiveCount: 0,
          withPagela: childrenWithPagela,
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

    let isWithinPeriod = false;

    if (!period) {
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

    if (period && expectedDate) {
      const expectedDateObj = new Date(expectedDate);
      const startDateObj = new Date(period.startDate);
      const endDateObj = new Date(period.endDate);

      isWithinPeriod =
        expectedDateObj >= startDateObj && expectedDateObj <= endDateObj;

      if (!isWithinPeriod) {
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
    } else if (period && !expectedDate) {
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
        note: 'Sem data esperada - indicadores não são gerados',
      };
    }

    const exception = expectedDate
      ? await this.findExceptionByDate(expectedDate)
      : null;

    let hasPassedClubDay = false;
    let isCurrentWeek = false;
    let isFutureWeek = false;
    if (expectedDate) {
      const currentAcademicWeek =
        await this.academicWeekService.calculateCurrentAcademicWeek();

      isCurrentWeek = !!(
        currentAcademicWeek &&
        currentAcademicWeek.academicYear === year &&
        currentAcademicWeek.academicWeek === week &&
        currentAcademicWeek.isWithinPeriod
      );

      if (
        currentAcademicWeek &&
        currentAcademicWeek.isWithinPeriod &&
        currentAcademicWeek.academicYear !== null &&
        currentAcademicWeek.academicWeek !== null
      ) {
        if (year > currentAcademicWeek.academicYear) {
          isFutureWeek = true;
        } else if (
          year === currentAcademicWeek.academicYear &&
          week > currentAcademicWeek.academicWeek
        ) {
          isFutureWeek = true;
        }
      }

      if (isFutureWeek) {
        hasPassedClubDay = false;
      } else if (!isCurrentWeek) {
        hasPassedClubDay = true;
      } else {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        hasPassedClubDay = todayStr > expectedDate;
      }
    }

    let status: string;
    if (exception) {
      status = 'exception';
    } else if (isFutureWeek) {
      if (childrenWithPagela === totalChildren && totalChildren > 0) {
        status = 'ok';
      } else if (childrenWithPagela > 0) {
        status = 'partial';
      } else {
        status = 'pending';
      }
    } else if (!hasPassedClubDay && isCurrentWeek) {
      if (childrenWithPagela === totalChildren && totalChildren > 0) {
        status = 'ok';
      } else {
        status = 'pending';
      }
    } else if (childrenWithPagela === totalChildren) {
      status = 'ok';
    } else if (childrenWithPagela > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    const indicators: any[] = [];

    if (inactiveChildren.length > 0) {
      indicators.push({
        type: 'children_not_attending',
        severity: 'warning',
        message: `⚠️ ${inactiveChildren.length} criança(s) que não frequentam mais os clubinhos`,
        details: {
          totalChildren: inactiveChildren.length,
          childrenList: inactiveChildren.map((c) => ({
            childId: c.id,
            childName: c.name,
            isActive: c.isActive,
            reason: 'Criança desativada',
          })),
          note: 'Crianças desativadas não entram nos indicadores positivos nem negativos, apenas neste indicador',
        },
      });
    }

    const completionRate =
      totalChildren > 0 ? (childrenWithPagela / totalChildren) * 100 : 0;
    const missingRate =
      totalChildren > 0 ? (childrenMissing / totalChildren) * 100 : 0;

    if (!exception) {
      if (status === 'ok') {
        if (totalChildren > 0) {
          indicators.push({
            type: 'all_ok',
            severity: 'success',
            message: `✅ Todas as ${totalChildren} crianças tiveram pagela`,
            details: {
              totalChildren,
              childrenWithPagela,
              childrenMissing,
              completionRate: Math.round(completionRate * 10) / 10,
              missingRate: 0,
              isPerfect: true,
            },
          });
        }
      } else if (status === 'pending') {
      } else if (status === 'partial') {
        if (hasPassedClubDay) {
          indicators.push({
            type: 'some_missing',
            severity: 'warning',
            message: `⚠️ ${childrenMissing} de ${totalChildren} crianças SEM pagela (${Math.round(missingRate)}% faltando)`,
            details: {
              totalChildren,
              childrenWithPagela,
              childrenMissing,
              completionRate: Math.round(completionRate * 10) / 10,
              missingRate: Math.round(missingRate * 10) / 10,
              isPerfect: false,
              needsAttention: true,
              urgency:
                missingRate > 50 ? 'high' : missingRate > 25 ? 'medium' : 'low',
            },
          });
        }
      } else if (status === 'missing') {
        if (hasPassedClubDay) {
          if (totalChildren > 0) {
            indicators.push({
              type: 'no_pagela',
              severity: 'critical',
              message: `🔴 NENHUMA pagela registrada (${totalChildren} crianças esperadas)`,
              details: {
                totalChildren,
                childrenWithPagela: 0,
                childrenMissing,
                completionRate: 0,
                missingRate: 100,
                isPerfect: false,
                needsAttention: true,
                urgency: 'critical',
                lastPagelaDate: null,
              },
            });
          } else {
            indicators.push({
              type: 'no_children',
              severity: 'warning',
              message: `⚠️ Clubinho sem crianças cadastradas`,
              details: {
                totalChildren: 0,
                childrenWithPagela: 0,
                childrenMissing: 0,
                completionRate: 0,
                missingRate: 0,
                isPerfect: false,
                needsAttention: false,
                urgency: 'low',
                possibleIssue:
                  'Clubinho pode estar inativo ou sem configuração de crianças',
              },
            });
          }
        }
      }
    } else {
      indicators.push({
        type: 'exception',
        severity: 'info',
        message: `ℹ️ Exceção global: ${exception.reason}`,
        details: {
          exceptionDate: exception.exceptionDate,
          reason: exception.reason,
          type: exception.type,
          isRecurrent: exception.isRecurrent,
          totalChildren,
          childrenWithPagela,
          childrenMissing,
          note: 'Pagelas não são obrigatórias nesta data devido à exceção cadastrada',
        },
      });
    }

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
  ): Promise<any> {
    const allClubs = await this.clubsRepository.find();
    const activeClubs = allClubs.filter((c) => c.isActive === true);
    const inactiveClubs = allClubs.filter((c) => c.isActive === false);

    let clubsResults = await Promise.all(
      activeClubs.map((club) =>
        this.clubWeekCheckService.checkClubWeek(club.id, year, week),
      ),
    );

    const inactiveClubsResults = await Promise.all(
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
              (i: any) => i.severity === 'critical',
            );
            const hasWarning = r.indicators?.some(
              (i: any) => i.severity === 'warning',
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
          r.indicators?.some((i: any) => i.severity === filters.severity),
        );
      }

      if (filters.indicatorType) {
        clubsResults = clubsResults.filter((r) =>
          r.indicators?.some((i: any) => i.type === filters.indicatorType),
        );
      }
    }

    const indicatorsByType: Record<string, any[]> = {
      all_ok: [],
      some_missing: [],
      no_pagela: [],
      no_children: [],
      exception: [],
      no_weekday: [],
      out_of_period: [],
      club_inactive: [],
      children_not_attending: [],
    };

    const clubsByStatus: Record<string, any[]> = {
      ok: [],
      partial: [],
      missing: [],
      exception: [],
      inactive: [],
      out_of_period: [],
    };

    let totalChildrenAll = 0;
    let totalChildrenWithPagela = 0;
    let totalChildrenMissing = 0;
    const clubsWithProblems: any[] = [];
    const clubsCritical: any[] = [];
    const clubsWarning: any[] = [];

    clubsResults.forEach((result) => {
      if (!clubsByStatus[result.status]) {
        clubsByStatus[result.status] = [];
      }
      clubsByStatus[result.status].push(result);

      if (result.indicators && result.indicators.length > 0) {
        result.indicators.forEach((indicator: any) => {
          const type = indicator.type;
          if (indicatorsByType[type]) {
            indicatorsByType[type].push({
              clubId: result.clubId,
              clubNumber: result.clubNumber,
              weekday: result.weekday,
              indicator,
              children: result.children,
              week: result.week,
            });
          }
        });

        const hasCritical = result.indicators.some(
          (i: any) => i.severity === 'critical',
        );
        const hasWarning = result.indicators.some(
          (i: any) => i.severity === 'warning',
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

    const statsByWeekday: Record<string, any> = {};
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
            r.indicators?.some((i: any) => i.severity === 'critical'),
          ).length,
          warning: clubsResults.filter((r) =>
            r.indicators?.some((i: any) => i.severity === 'warning'),
          ).length,
          info: clubsResults.filter((r) =>
            r.indicators?.some((i: any) => i.severity === 'info'),
          ).length,
          success: clubsResults.filter((r) =>
            r.indicators?.some((i: any) => i.severity === 'success'),
          ).length,
        },
      },
    };

    return {
      executiveSummary,
      indicators: {
        byType: indicatorsByType,
        critical: indicatorsByType.no_pagela.map((item: any) => ({
          clubId: item.clubId,
          clubNumber: item.clubNumber,
          weekday: item.weekday,
          indicator: item.indicator,
          children: item.children,
        })),
        warning: [
          ...indicatorsByType.some_missing,
          ...indicatorsByType.no_children,
        ].map((item: any) => ({
          clubId: item.clubId,
          clubNumber: item.clubNumber,
          weekday: item.weekday,
          indicator: item.indicator,
          children: item.children,
        })),
      },
      clubs: {
        byStatus: clubsByStatus,
        withProblems: clubsWithProblems.map((c) => ({
          clubId: c.clubId,
          clubNumber: c.clubNumber,
          weekday: c.weekday,
          status: c.status,
          indicators: c.indicators,
          children: c.children,
          week: c.week,
        })),
        critical: clubsCritical.map((c) => ({
          clubId: c.clubId,
          clubNumber: c.clubNumber,
          weekday: c.weekday,
          status: c.status,
          indicators: c.indicators,
          children: c.children,
          week: c.week,
        })),
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
