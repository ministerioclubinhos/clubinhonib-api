import { Injectable } from '@nestjs/common';
import { PeriodCalculator, PeriodShortcut } from '../dto/period-filter.dto';

@Injectable()
export class StatisticsPeriodService {
  applyPeriodFilter<
    T extends {
      period?: PeriodShortcut;
      startDate?: string;
      endDate?: string;
      year?: number;
    },
  >(filters: T): T {
    if (!filters.period) {
      return filters;
    }

    const calculated = PeriodCalculator.calculatePeriod(filters);

    return {
      ...filters,
      startDate: calculated.startDate,
      endDate: calculated.endDate,
    };
  }

  getPeriodSummary<
    T extends { period?: PeriodShortcut; startDate?: string; endDate?: string },
  >(filters: T): string {
    if (filters.period) {
      return PeriodCalculator.getPeriodLabel(filters);
    }

    if (filters.startDate && filters.endDate) {
      return `${filters.startDate} até ${filters.endDate}`;
    }

    if (filters.startDate) {
      return `A partir de ${filters.startDate}`;
    }

    if (filters.endDate) {
      return `Até ${filters.endDate}`;
    }

    return 'Sem período definido';
  }
}
