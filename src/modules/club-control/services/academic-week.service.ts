import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubPeriodEntity } from '../entities/club-period.entity';
import { getAcademicWeekYear } from 'src/modules/pagelas/week.util';

@Injectable()
export class AcademicWeekService {
  constructor(
    @InjectRepository(ClubPeriodEntity)
    private readonly periodsRepository: Repository<ClubPeriodEntity>,
  ) {}

  async calculateCurrentAcademicWeek(): Promise<{
    academicYear: number | null;
    academicWeek: number | null;
    isWithinPeriod: boolean;
    periodStartDate: string | null;
    periodEndDate: string | null;
  } | null> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const period = await this.periodsRepository.findOne({
      where: { year: currentYear, isActive: true },
    });
    
    if (!period) {
      return {
        academicYear: null,
        academicWeek: null,
        isWithinPeriod: false,
        periodStartDate: null,
        periodEndDate: null,
      };
    }

    const startDate = new Date(period.startDate + 'T00:00:00');
    const endDate = new Date(period.endDate + 'T23:59:59');
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nowDateStr = nowDate.toISOString().split('T')[0];
    
    if (nowDate < startDate || nowDate > endDate) {
      return {
        academicYear: period.year,
        academicWeek: 0,
        isWithinPeriod: false,
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
      };
    }

    try {
      const weekData = getAcademicWeekYear(
        nowDateStr,
        period.startDate,
        period.endDate,
        period.year
      );
      
      return {
        academicYear: weekData.year,
        academicWeek: weekData.week,
        isWithinPeriod: true,
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
      };
    } catch (error) {
      return {
        academicYear: period.year,
        academicWeek: 0,
        isWithinPeriod: false,
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
      };
    }
  }

  getExpectedDateForAcademicWeek(
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

    return date.toISOString().split('T')[0];
  }

  calculateMaxAcademicWeek(period: ClubPeriodEntity): number {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    
    const startWeekStart = this.getWeekStartDate(start);
    const endWeekStart = this.getWeekStartDate(end);
    
    const daysDiff = Math.floor((endWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.floor(daysDiff / 7) + 1;
  }

  isWeekWithinPeriod(
    year: number,
    week: number,
    period: ClubPeriodEntity | null,
    weekDates: string[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  ): boolean {
    if (!period) return false;

    const periodStart = new Date(period.startDate + 'T00:00:00');
    const periodEnd = new Date(period.endDate + 'T23:59:59');
    
    for (const weekday of weekDates) {
      const expectedDate = this.getExpectedDateForAcademicWeek(year, week, weekday, period);
      const expectedDateObj = new Date(expectedDate + 'T00:00:00');
      
      if (expectedDateObj >= periodStart && expectedDateObj <= periodEnd) {
        return true;
      }
    }
    
    return false;
  }

  isExpectedDateWithinPeriod(expectedDate: string, period: ClubPeriodEntity | null): boolean {
    if (!period || !expectedDate) return false;
    
    const expectedDateObj = new Date(expectedDate);
    const startDateObj = new Date(period.startDate);
    const endDateObj = new Date(period.endDate);

    return expectedDateObj >= startDateObj && expectedDateObj <= endDateObj;
  }

  async getWeekType(
    year: number,
    week: number,
  ): Promise<{ isCurrent: boolean; isFuture: boolean; isPast: boolean }> {
    const currentAcademicWeek = await this.calculateCurrentAcademicWeek();
    
    if (!currentAcademicWeek || !currentAcademicWeek.isWithinPeriod || 
        currentAcademicWeek.academicYear === null || currentAcademicWeek.academicWeek === null) {
      return { isCurrent: false, isFuture: false, isPast: true };
    }

    const isCurrent = currentAcademicWeek.academicYear === year && 
                     currentAcademicWeek.academicWeek === week;
    
    let isFuture = false;
    if (year > currentAcademicWeek.academicYear) {
      isFuture = true;
    } else if (year === currentAcademicWeek.academicYear && week > currentAcademicWeek.academicWeek) {
      isFuture = true;
    }

    const isPast = !isCurrent && !isFuture;

    return { isCurrent, isFuture, isPast };
  }

  hasPassedClubDay(expectedDate: string, isCurrentWeek: boolean, isFutureWeek: boolean): boolean {
    if (isFutureWeek) {
      return false;
    }

    if (!isCurrentWeek) {
      return true;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    return todayStr > expectedDate;
  }

  getWeekStartDate(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}
