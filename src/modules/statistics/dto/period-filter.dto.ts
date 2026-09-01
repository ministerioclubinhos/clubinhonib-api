import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
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
  @IsOptional()
  @IsEnum(PeriodShortcut)
  period?: PeriodShortcut;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'])
  groupBy?: 'day' | 'week' | 'month' | 'year';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;
}

export class PeriodCalculator {
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static calculatePeriod(filter: PeriodFilterDto): {
    startDate: string;
    endDate: string;
    groupBy?: string;
  } {
    const now = new Date();
    const today = this.formatDate(now);

    switch (filter.period) {
      case PeriodShortcut.TODAY:
        return {
          startDate: today,
          endDate: today,
          groupBy: 'day',
        };

      case PeriodShortcut.THIS_WEEK: {
        const startOfWeek = new Date(now);
        const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
        startOfWeek.setDate(now.getDate() - daysSinceMonday);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 5);

        return {
          startDate: this.formatDate(startOfWeek),
          endDate: this.formatDate(endOfWeek),
          groupBy: 'day',
        };
      }

      case PeriodShortcut.THIS_MONTH: {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        return {
          startDate: this.formatDate(startOfMonth),
          endDate: this.formatDate(endOfMonth),
          groupBy: 'week',
        };
      }

      case PeriodShortcut.LAST_7_DAYS: {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);

        return {
          startDate: this.formatDate(sevenDaysAgo),
          endDate: today,
          groupBy: 'day',
        };
      }

      case PeriodShortcut.LAST_30_DAYS: {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 29);

        return {
          startDate: this.formatDate(thirtyDaysAgo),
          endDate: today,
          groupBy: 'day',
        };
      }

      case PeriodShortcut.THIS_YEAR: {
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        return {
          startDate: this.formatDate(startOfYear),
          endDate: today,
          groupBy: 'month',
        };
      }

      case PeriodShortcut.CUSTOM:
      default: {
        if (filter.startDate && filter.endDate) {
          return {
            startDate: filter.startDate,
            endDate: filter.endDate,
            groupBy: filter.groupBy,
          };
        }

        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);

        return {
          startDate: this.formatDate(oneMonthAgo),
          endDate: today,
          groupBy: 'day',
        };
      }
    }
  }

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
