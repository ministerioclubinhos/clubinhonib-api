import { ClubCheckResultDto } from './club-check-result.dto';
import {
  ClubIndicatorDetailDto,
  WeekdayStatsDto,
} from './detailed-indicators-helpers.dto';
import {
  ChildNotAttendingDto,
  DashboardCurrentWeekDto,
  InactiveClubDto,
} from './club-control-contracts.dto';

/**
 * Contrato de `GET /club-control/indicators/detailed`.
 *
 * Onze campos deste arquivo eram `any` — o retorno mais rico da API, e o único
 * sem forma declarada. Cada um foi trocado pelo tipo que o repositório já
 * monta; nenhum é novo.
 */

/** Contagem de clubinhos por situação na semana. */
export class DetailedOverallSummaryDto {
  totalClubs: number;
  totalClubsInactive: number;
  clubsOk: number;
  clubsPending: number;
  clubsPartial: number;
  clubsMissing: number;
  clubsException: number;
  clubsInactive: number;
  clubsOutOfPeriod: number;
  clubsWithProblems: number;
  clubsCritical: number;
  clubsWarning: number;
}

/** Como as crianças se distribuem entre presença, falta e afastamento. */
export class DetailedChildrenSummaryDto {
  total: number;
  withPagela: number;
  missing: number;
  completionRate: number;
  missingRate: number;
  notAttending: {
    total: number;
    /** Crianças de clubinhos desativados. */
    fromInactiveClubs: number;
    /** Crianças desativadas em clubinhos ativos. */
    fromInactiveChildren: number;
  };
}

/** Quantos indicadores foram emitidos, por tipo e por gravidade. */
export class DetailedIndicatorsSummaryDto {
  total: number;
  byType: Record<string, number>;
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
    success: number;
  };
}

/** O resumo que abre a tela, antes de qualquer lista. */
export class DetailedExecutiveSummaryDto {
  week: {
    year: number;
    week: number;
    expectedDate: string | null;
  };
  overall: DetailedOverallSummaryDto;
  children: DetailedChildrenSummaryDto;
  indicators: DetailedIndicatorsSummaryDto;
}

/** Um indicador na lista de críticos ou de avisos. */
export class DetailedIndicatorEntryDto {
  clubId: string;
  clubNumber: number;
  weekday: string;
  indicator: ClubIndicatorDetailDto['indicator'];
  children: ClubIndicatorDetailDto['children'];
}

/** Taxas gerais da semana. */
export class DetailedOverallStatisticsDto {
  completionRate: number;
  missingRate: number;
  problemsRate: number;
}

export class DetailedIndicatorsResultDto {
  executiveSummary: DetailedExecutiveSummaryDto;

  indicators: {
    byType: Record<string, ClubIndicatorDetailDto[]>;
    critical: DetailedIndicatorEntryDto[];
    warning: DetailedIndicatorEntryDto[];
  };

  clubs: {
    byStatus: Record<string, ClubCheckResultDto[]>;
    withProblems: ClubCheckResultDto[];
    critical: ClubCheckResultDto[];
    warning: ClubCheckResultDto[];
  };

  statistics: {
    byWeekday: WeekdayStatsDto[];
    overall: DetailedOverallStatisticsDto;
  };

  recommendations: string[];

  /** `null` quando o ano não tem período letivo cadastrado. */
  currentWeek: DashboardCurrentWeekDto | null;
  inactiveClubs: InactiveClubDto[];
  childrenNotAttending: {
    total: number;
    list: ChildNotAttendingDto[];
  };

  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    clubsWithProblems?: ClubCheckResultDto[];
    clubsCritical?: ClubCheckResultDto[];
  };
}
