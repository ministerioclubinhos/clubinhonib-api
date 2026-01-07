import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum PeriodShortcut {
  TODAY = 'today',
  THIS_WEEK = 'this_week',
  THIS_MONTH = 'this_month',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom',
}

export class PeriodFilterDto {
  // Atalho rápido de período
  @IsOptional()
  @IsEnum(PeriodShortcut)
  period?: PeriodShortcut;

  // Datas customizadas (quando period = 'custom')
  @IsOptional()
  @IsString()
  startDate?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  endDate?: string; // YYYY-MM-DD

  // Agrupamento
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'])
  groupBy?: 'day' | 'week' | 'month' | 'year';

  // Ano específico (opcional)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;
}

/**
 * Helper para calcular períodos baseados em atalhos
 */
export class PeriodCalculator {
  static calculatePeriod(filter: PeriodFilterDto): {
    startDate: string;
    endDate: string;
    groupBy?: string;
  } {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (filter.period) {
      case PeriodShortcut.TODAY:
        return {
          startDate: today,
          endDate: today,
          groupBy: 'day',
        };

      case PeriodShortcut.THIS_WEEK: {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        return {
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate: endOfWeek.toISOString().split('T')[0],
          groupBy: 'day',
        };
      }

      case PeriodShortcut.THIS_MONTH: {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        return {
          startDate: startOfMonth.toISOString().split('T')[0],
          endDate: endOfMonth.toISOString().split('T')[0],
          groupBy: 'week',
        };
      }

      case PeriodShortcut.LAST_7_DAYS: {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);

        return {
          startDate: sevenDaysAgo.toISOString().split('T')[0],
          endDate: today,
          groupBy: 'day',
        };
      }

      case PeriodShortcut.LAST_30_DAYS: {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        return {
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: today,
          groupBy: 'day',
        };
      }

      case PeriodShortcut.THIS_YEAR: {
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        return {
          startDate: startOfYear.toISOString().split('T')[0],
          endDate: today,
          groupBy: 'month',
        };
      }

      case PeriodShortcut.CUSTOM:
      default:
        // Se tem startDate e endDate customizados, usa eles
        if (filter.startDate && filter.endDate) {
          return {
            startDate: filter.startDate,
            endDate: filter.endDate,
            groupBy: filter.groupBy,
          };
        }

        // Fallback: último mês
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);

        return {
          startDate: oneMonthAgo.toISOString().split('T')[0],
          endDate: today,
          groupBy: 'day',
        };
    }
  }

  /**
   * Retorna o label amigável do período
   */
  static getPeriodLabel(filter: PeriodFilterDto): string {
    switch (filter.period) {
      case PeriodShortcut.TODAY:
        return 'Hoje';
      case PeriodShortcut.THIS_WEEK:
        return 'Esta Semana';
      case PeriodShortcut.THIS_MONTH:
        return 'Este Mês';
      case PeriodShortcut.LAST_7_DAYS:
        return 'Últimos 7 Dias';
      case PeriodShortcut.LAST_30_DAYS:
        return 'Últimos 30 Dias';
      case PeriodShortcut.THIS_YEAR:
        return 'Este Ano';
      case PeriodShortcut.CUSTOM:
        if (filter.startDate && filter.endDate) {
          return `${filter.startDate} até ${filter.endDate}`;
        }
        return 'Período Customizado';
      default:
        return 'Período não definido';
    }
  }
}
