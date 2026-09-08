import { Weekday } from 'src/modules/clubs/entities/weekday.enum';

import { ClubWeekStatus, ClubWeekTimeline } from '../constants';

/**
 * Contrato do resumo semanal dos clubinhos.
 *
 * É o retrato do período letivo inteiro visto de cima: uma linha por semana,
 * uma célula por clubinho. Nenhuma criança é nomeada aqui — quem precisa do
 * detalhe de uma semana abre o controle de clubinhos ou as pagelas.
 */

/** Os números de uma semana, de um clubinho ou do conjunto. */
export class ClubWeeklySummaryCountsDto {
  /** Crianças consideradas: ativas e que já tinham entrado na data. */
  children: number;
  childrenWithPagela: number;
  childrenMissing: number;
  /** Pagelas lançadas com presença marcada. */
  childrenPresent: number;
  /** Percentual de pagelas lançadas, com uma casa decimal. */
  completionRate: number;
}

/** Quantos clubinhos ficaram em cada situação. */
export class ClubWeeklySummaryStatusCountsDto {
  ok: number;
  partial: number;
  missing: number;
  pending: number;
  exception: number;
  inactive: number;
  outOfPeriod: number;
}

/** Um clubinho do recorte de quem pediu. */
export class ClubWeeklySummaryClubDto {
  clubId: string;
  clubNumber: number;
  weekday: Weekday;
  isActive: boolean;
}

/** A situação de um clubinho numa semana. */
export class ClubWeeklySummaryCellDto {
  clubId: string;
  clubNumber: number;
  status: ClubWeekStatus;
  /** Dia em que o clubinho deveria acontecer, em `YYYY-MM-DD`. */
  expectedDate: string | null;
  /** Motivo do dia sem Clubinho; `null` quando não houve exceção. */
  exceptionReason: string | null;
  counts: ClubWeeklySummaryCountsDto;
}

/** Uma semana letiva, com o que aconteceu em cada clubinho. */
export class ClubWeeklySummaryWeekDto {
  week: number;
  /** Segunda-feira da semana letiva, em `YYYY-MM-DD`. */
  startDate: string;
  /** Sábado da semana letiva, em `YYYY-MM-DD`. */
  endDate: string;
  timeline: ClubWeekTimeline;
  counts: ClubWeeklySummaryCountsDto;
  statusCounts: ClubWeeklySummaryStatusCountsDto;
  clubs: ClubWeeklySummaryCellDto[];
}

/** O período letivo consultado. */
export class ClubWeeklySummaryPeriodDto {
  year: number;
  startDate: string;
  endDate: string;
  totalWeeks: number;
}

/**
 * A leitura do período até aqui.
 *
 * Só as semanas já decorridas entram: incluir as futuras derrubaria a média
 * para perto de zero e faria o ano inteiro parecer atrasado em março.
 */
export class ClubWeeklySummaryHighlightsDto {
  weeksElapsed: number;
  counts: ClubWeeklySummaryCountsDto;
  /** Semana com a maior cobertura entre as decorridas; `null` se não houver. */
  bestWeek: number | null;
  /** Semana com a menor cobertura entre as decorridas; `null` se não houver. */
  worstWeek: number | null;
  /** Semanas decorridas em que algum clubinho ficou devendo pagela. */
  weeksWithPendency: number;
}

/** Resposta de `GET /club-control/weekly-summary`. */
export class ClubWeeklySummaryDto {
  year: number;
  /** Anos letivos cadastrados, do mais novo para o mais antigo. */
  availableYears: number[];
  /** Semana letiva de hoje; `null` fora do período. */
  currentWeek: number | null;
  /** `null` quando o ano pedido não tem período letivo cadastrado. */
  period: ClubWeeklySummaryPeriodDto | null;
  clubs: ClubWeeklySummaryClubDto[];
  weeks: ClubWeeklySummaryWeekDto[];
  highlights: ClubWeeklySummaryHighlightsDto;
}
