import { Injectable } from '@nestjs/common';
import {
  AppNotFoundException,
  AppConflictException,
  ErrorCode,
} from 'src/shared/exceptions';
import { ClubControlRepository } from '../repositories/club-control.repository';
import { CreateClubPeriodDto } from '../dto/create-club-period.dto';
import { UpdateClubPeriodDto } from '../dto/update-club-period.dto';
import { CreateClubExceptionDto } from '../dto/create-club-exception.dto';
import { AcademicWeekService } from './academic-week.service';
import { ClubWeekCheckService } from './club-week-check.service';

@Injectable()
export class ClubControlService {
  constructor(
    private readonly clubControlRepository: ClubControlRepository,
    private readonly academicWeekService: AcademicWeekService,
    private readonly clubWeekCheckService: ClubWeekCheckService,
  ) {}

  async createPeriod(dto: CreateClubPeriodDto) {
    const existing = await this.clubControlRepository.findAnyPeriodByYear(
      dto.year,
    );
    if (existing) {
      if (existing.isActive) {
        throw new AppConflictException(
          ErrorCode.RESOURCE_CONFLICT,
          `Período letivo para o ano ${dto.year} já existe`,
        );
      }
      existing.startDate = dto.startDate;
      existing.endDate = dto.endDate;
      existing.description = dto.description;
      existing.isActive = dto.isActive ?? true;
      return this.clubControlRepository.savePeriod(existing);
    }

    return this.clubControlRepository.createPeriod({
      year: dto.year,
      startDate: dto.startDate,
      endDate: dto.endDate,
      description: dto.description,
      isActive: dto.isActive ?? true,
    });
  }

  async getPeriodByYear(year: number) {
    return this.clubControlRepository.findPeriodByYear(year);
  }

  async getAllPeriods(page?: number, limit?: number) {
    return this.clubControlRepository.findAllPeriods(page, limit);
  }

  async updatePeriod(id: string, dto: UpdateClubPeriodDto) {
    const existing = await this.clubControlRepository.findPeriodById(id);
    if (!existing) {
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Período com id ${id} não encontrado`,
      );
    }

    if (dto.startDate !== undefined) existing.startDate = dto.startDate;
    if (dto.endDate !== undefined) existing.endDate = dto.endDate;
    if (dto.description !== undefined) existing.description = dto.description;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;

    return this.clubControlRepository.savePeriod(existing);
  }

  async deletePeriod(id: string) {
    return this.clubControlRepository.deletePeriod(id);
  }

  async createException(dto: CreateClubExceptionDto) {
    return this.clubControlRepository.createException({
      exceptionDate: dto.exceptionDate,
      reason: dto.reason,
      type: dto.type || 'other',
      notes: dto.notes,
      isActive: dto.isActive ?? true,
      isRecurrent: dto.isRecurrent ?? false,
    });
  }

  async getExceptionByDate(date: string) {
    return this.clubControlRepository.findExceptionByDate(date);
  }

  async getExceptionsByPeriod(
    startDate?: string,
    endDate?: string,
    page?: number,
    limit?: number,
  ) {
    return this.clubControlRepository.findExceptionsByPeriod(
      startDate,
      endDate,
      page,
      limit,
    );
  }

  async deleteException(id: string) {
    return this.clubControlRepository.deleteException(id);
  }

  async checkClubWeek(clubId: string, year: number, week: number) {
    return this.clubWeekCheckService.checkClubWeek(clubId, year, week);
  }

  async checkAllClubsWeek(
    year?: number,
    week?: number,
    page: number = 1,
    limit: number = 50,
  ) {
    let finalYear = year;
    let finalWeek = week;

    if (year === undefined || week === undefined) {
      const currentAcademicWeek = await this.getCurrentAcademicWeek();

      if (!currentAcademicWeek) {
        return {
          year: null,
          week: null,
          summary: {
            totalClubs: 0,
            clubsOk: 0,
            clubsPending: 0,
            clubsPartial: 0,
            clubsMissing: 0,
            clubsException: 0,
            clubsInactive: 0,
            clubsOutOfPeriod: 0,
            totalClubsInactive: 0,
            totalChildrenNotAttending: 0,
            inactiveClubsCount: 0,
          },
          clubs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          currentWeek: {
            academicYear: null,
            academicWeek: null,
            isWithinPeriod: false,
            periodStartDate: null,
            periodEndDate: null,
          },
          note: 'Período letivo não cadastrado - nenhum clube retornado',
        };
      }

      finalYear = currentAcademicWeek.year;
      finalWeek = currentAcademicWeek.week;

      if (!currentAcademicWeek.isWithinPeriod) {
        return {
          year: finalYear,
          week: finalWeek,
          summary: {
            totalClubs: 0,
            clubsOk: 0,
            clubsPending: 0,
            clubsPartial: 0,
            clubsMissing: 0,
            clubsException: 0,
            clubsInactive: 0,
            clubsOutOfPeriod: 0,
            totalClubsInactive: 0,
            totalChildrenNotAttending: 0,
            inactiveClubsCount: 0,
          },
          clubs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          currentWeek: {
            academicYear: finalYear,
            academicWeek: finalWeek,
            isWithinPeriod: false,
            periodStartDate: currentAcademicWeek.periodStartDate,
            periodEndDate: currentAcademicWeek.periodEndDate,
          },
          note: 'Fora do período letivo - nenhum clube retornado',
        };
      }
    }

    return this.checkAllClubsWeekLogic(finalYear!, finalWeek!, page, limit);
  }

  private async checkAllClubsWeekLogic(
    year: number,
    week: number,
    page: number,
    limit: number,
  ) {
    const period = await this.clubControlRepository.findPeriodByYear(year);

    if (!period) {
      const currentAcademicWeek =
        await this.academicWeekService.calculateCurrentAcademicWeek();
      return {
        year,
        week,
        summary: {
          totalClubs: 0,
          clubsOk: 0,
          clubsPending: 0,
          clubsPartial: 0,
          clubsMissing: 0,
          clubsException: 0,
          clubsInactive: 0,
          clubsOutOfPeriod: 0,
          totalClubsInactive: 0,
          totalChildrenNotAttending: 0,
          inactiveClubsCount: 0,
        },
        clubs: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        currentWeek: currentAcademicWeek || {
          academicYear: null,
          academicWeek: null,
          isWithinPeriod: false,
          periodStartDate: null,
          periodEndDate: null,
        },
        note: 'Período letivo não cadastrado - nenhum clube retornado',
      };
    }

    const isWeekWithinPeriod = this.academicWeekService.isWeekWithinPeriod(
      year,
      week,
      period,
    );

    if (!isWeekWithinPeriod) {
      const currentAcademicWeek =
        await this.academicWeekService.calculateCurrentAcademicWeek();
      return {
        year,
        week,
        summary: {
          totalClubs: 0,
          clubsOk: 0,
          clubsPending: 0,
          clubsPartial: 0,
          clubsMissing: 0,
          clubsException: 0,
          clubsInactive: 0,
          clubsOutOfPeriod: 0,
          totalClubsInactive: 0,
          totalChildrenNotAttending: 0,
          inactiveClubsCount: 0,
        },
        clubs: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        currentWeek: currentAcademicWeek || {
          academicYear: period.year,
          academicWeek: null,
          isWithinPeriod: false,
          periodStartDate: period.startDate,
          periodEndDate: period.endDate,
        },
        period: {
          year: period.year,
          startDate: period.startDate,
          endDate: period.endDate,
        },
        note: `Semana ${week} do ano letivo ${year} está fora do período letivo (${new Date(period.startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(period.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}) - nenhum clube retornado`,
      };
    }

    const allClubs = await this.clubControlRepository.findAllClubs();
    const activeClubs = allClubs.filter((c) => c.isActive === true);
    const inactiveClubs = allClubs.filter((c) => c.isActive === false);

    const clubsResults = await Promise.all(
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

    const statusPriority: Record<string, number> = {
      missing: 1,
      partial: 2,
      exception: 3,
      inactive: 4,
      out_of_period: 5,
      pending: 6,
      ok: 7,
    };

    clubsResults.sort((a, b) => {
      const priorityA = statusPriority[a.status] || 99;
      const priorityB = statusPriority[b.status] || 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.clubNumber - b.clubNumber;
    });

    const summary = {
      totalClubs: activeClubs.length,
      totalClubsInactive: inactiveClubs.length,
      clubsOk: clubsResults.filter((r) => r.status === 'ok').length,
      clubsPending: clubsResults.filter((r) => r.status === 'pending').length,
      clubsPartial: clubsResults.filter((r) => r.status === 'partial').length,
      clubsMissing: clubsResults.filter((r) => r.status === 'missing').length,
      clubsException: clubsResults.filter((r) => r.status === 'exception')
        .length,
      clubsInactive: clubsResults.filter((r) => r.status === 'inactive').length,
      clubsOutOfPeriod: clubsResults.filter((r) => r.status === 'out_of_period')
        .length,
      totalChildrenNotAttending,
      inactiveClubsCount: inactiveClubs.length,
    };

    const total = clubsResults.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const pagedClubs = clubsResults.slice(start, end);
    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: end < total,
      hasPreviousPage: start > 0,
    };

    const currentAcademicWeek =
      await this.academicWeekService.calculateCurrentAcademicWeek();

    return {
      year,
      week,
      summary,
      clubs: pagedClubs,
      pagination,
      currentWeek: currentAcademicWeek,
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
    };
  }

  async getCurrentWeekDashboard() {
    const result = await this.checkAllClubsWeek();
    const currentAcademicWeek = await this.getCurrentAcademicWeek();

    return {
      ...result,
      currentWeek: {
        academicYear: currentAcademicWeek?.year || null,
        academicWeek: currentAcademicWeek?.week || null,
        isWithinPeriod: currentAcademicWeek?.isWithinPeriod || false,
        periodStartDate: currentAcademicWeek?.periodStartDate || null,
        periodEndDate: currentAcademicWeek?.periodEndDate || null,
      },
    };
  }

  async getCurrentAcademicWeek(): Promise<{
    year: number;
    week: number;
    isWithinPeriod: boolean;
    periodStartDate: string;
    periodEndDate: string;
  } | null> {
    const result =
      await this.academicWeekService.calculateCurrentAcademicWeek();

    if (!result || !result.academicYear || !result.academicWeek) {
      return null;
    }

    return {
      year: result.academicYear,
      week: result.academicWeek,
      isWithinPeriod: result.isWithinPeriod,
      periodStartDate: result.periodStartDate || '',
      periodEndDate: result.periodEndDate || '',
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
  ) {
    return this.clubControlRepository.getDetailedIndicators(
      year,
      week,
      filters,
    );
  }
}
