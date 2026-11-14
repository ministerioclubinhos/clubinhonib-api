import { ClubCheckResultDto } from './club-check-result.dto';

/**
 * Contratos de resposta de `/club-control`.
 *
 * Os quinze métodos do controller devolviam o tipo inferido do service, e o
 * service, o do repositório — que entrega entidade. Sem tipo declarado, uma
 * coluna nova numa entidade passava a sair pela rota sem erro de compilação e
 * sem teste quebrando.
 */

/** Recorte de página, igual ao das outras listagens. */
export class ClubControlPaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Resultado de uma remoção. */
export class DeleteResultDto {
  success: boolean;
}

/** Um período letivo no contrato público. */
export class ClubPeriodResponseDto {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Uma exceção de calendário (feriado, recesso) no contrato público. */
export class ClubExceptionResponseDto {
  id: string;
  exceptionDate: string;
  reason: string;
  type: string;
  notes: string | null;
  isActive: boolean;
  /** Repete todo ano na mesma data. */
  isRecurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export class PaginatedClubPeriodsDto {
  items: ClubPeriodResponseDto[];
  total: number;
}

export class PaginatedClubExceptionsDto {
  items: ClubExceptionResponseDto[];
  total: number;
}

/** A semana letiva corrente, ou `null` fora do período. */
export class CurrentAcademicWeekDto {
  year: number;
  week: number;
  isWithinPeriod: boolean;
  periodStartDate: string;
  periodEndDate: string;
}

/**
 * A semana corrente como o painel a mostra.
 *
 * Difere de `CurrentAcademicWeekDto` porque aqui os campos vêm nulos quando o
 * ano não tem período letivo cadastrado — o painel abre mesmo assim.
 */
export class DashboardCurrentWeekDto {
  academicYear: number | null;
  academicWeek: number | null;
  isWithinPeriod: boolean;
  periodStartDate: string | null;
  periodEndDate: string | null;
}

/** Contagem por situação dos clubinhos na semana. */
export class ClubsWeekSummaryDto {
  totalClubs: number;
  clubsOk: number;
  clubsPending: number;
  clubsPartial: number;
  clubsMissing: number;
  clubsException: number;
  clubsInactive: number;
  clubsOutOfPeriod: number;
  totalClubsInactive: number;
  totalChildrenNotAttending: number;
  inactiveClubsCount: number;
}

/** Um clubinho desativado, listado à parte da conferência. */
export class InactiveClubDto {
  clubId: string;
  clubNumber: number;
  weekday: string;
  isActive: boolean;
}

/** Uma criança que consta no clubinho mas não vem. */
export class ChildNotAttendingDto {
  childId: string;
  childName: string;
  /** Ausente nas linhas antigas, que não guardavam a situação da criança. */
  isActive?: boolean;
}

/**
 * Conferência de todos os clubinhos de uma semana.
 *
 * `year` e `week` vêm nulos, e `clubs` vazio, quando não há período letivo
 * cadastrado ou a data está fora dele — nesses casos `note` explica por quê.
 */
export class ClubsWeekCheckResponseDto {
  year: number | null;
  week: number | null;
  summary: ClubsWeekSummaryDto;
  clubs: ClubCheckResultDto[];
  pagination: ClubControlPaginationDto;
  currentWeek: DashboardCurrentWeekDto | null;
  /** Só nas respostas vazias, explicando por que não há clubinho na lista. */
  note?: string;
  /** Só quando a semana pedida cai fora do período letivo cadastrado. */
  period?: {
    year: number;
    startDate: string;
    endDate: string;
  };
  inactiveClubs?: InactiveClubDto[];
  childrenNotAttending?: {
    total: number;
    list: ChildNotAttendingDto[];
  };
}

/** O painel da semana: a conferência mais o recorte da semana corrente. */
export class ClubControlDashboardResponseDto extends ClubsWeekCheckResponseDto {
  /** No painel a semana corrente sempre vem, ainda que com campos nulos. */
  declare currentWeek: DashboardCurrentWeekDto;
}

/**
 * Período letivo reduzido ao que o calendário precisa para saber até quando um
 * encontro de clubinho vale.
 */
export class ClubPeriodWindowDto {
  year: number;
  startDate: string;
  endDate: string;
}

/** Data sem Clubinho, reduzida ao que o calendário precisa. */
export class ClubExceptionWindowDto {
  exceptionDate: string;
  /** Vale para o mesmo dia e mês em qualquer ano. */
  isRecurrent: boolean;
}

/**
 * O que define quando um encontro de clubinho acontece.
 *
 * Os dois conjuntos andam juntos porque a resposta a "esse clubinho tem
 * encontro no dia X?" precisa dos dois ao mesmo tempo: a data tem que cair
 * dentro de um período letivo ativo **e** ficar fora das exceções. Devolver um
 * sem o outro convidaria quem chama a montar meia regra.
 */
export class ClubCalendarRulesDto {
  periods: ClubPeriodWindowDto[];
  exceptions: ClubExceptionWindowDto[];
}
