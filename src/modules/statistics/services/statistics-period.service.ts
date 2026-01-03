import { Injectable } from '@nestjs/common';
import { PeriodCalculator, PeriodShortcut } from '../dto/period-filter.dto';

@Injectable()
export class StatisticsPeriodService {
  /**
   * Aplica filtro de período em qualquer DTO que tenha period, startDate, endDate
   */
  applyPeriodFilter<T extends { period?: PeriodShortcut; startDate?: string; endDate?: string; year?: number }>(
    filters: T,
  ): T {
    // Se não tem period definido, retorna os filtros como estão
    if (!filters.period) {
      return filters;
    }

    // Calcula o período baseado no atalho
    const calculated = PeriodCalculator.calculatePeriod(filters);

    // Retorna os filtros com as datas calculadas
    return {
      ...filters,
      startDate: calculated.startDate,
      endDate: calculated.endDate,
    };
  }

  /**
   * Retorna um resumo legível do período aplicado
   */
  getPeriodSummary<T extends { period?: PeriodShortcut; startDate?: string; endDate?: string }>(
    filters: T,
  ): string {
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
