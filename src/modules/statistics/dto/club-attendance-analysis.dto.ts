/**
 * Contrato das duas rotas de frequência (`/statistics/attendance/...`).
 *
 * Estava defasado do que o repositório realmente devolvia, porque lá o retorno
 * era `any` e nada conferia. A diferença não era pequena: paginação, contagem
 * de exceções, dois estados de clubinho e um tipo de alerta chegavam ao
 * navegador sem constar aqui. Este arquivo agora descreve o que a rota entrega.
 */

/** Recorte de página, igual ao das outras listagens. */
export class AttendancePaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Uma semana em que o clubinho era esperado e não registrou pagela. */
export class MissingWeekDto {
  year: number;
  week: number;
  expectedDate: string;
  expectedChildren: number;
  weekRange: {
    start: string;
    end: string;
  };
  reason: 'no_pagela';
  severity: 'warning';
}

/** Uma semana da linha do tempo do clubinho. */
export class AttendanceTimelineWeekDto {
  year: number;
  week: number;
  date: string;
  hasPagela: boolean;
  /** Semana marcada como exceção (feriado, recesso) não conta como falta. */
  isException: boolean;
  /** A data ainda não chegou: não é falta, é futuro. */
  isPending: boolean;
  expectedChildren: number;
  /** Só vem quando a semana tem pagela. */
  totalPagelas?: number;
  /** `YYYY-MM-DD`. */
  firstDate?: string;
  presenceCount?: number;
}

/**
 * Um alerta de frequência de clubinho.
 *
 * `low_attendance` e `info` já eram emitidos e não constavam na união antiga.
 */
export class ClubAttendanceAlertDto {
  type:
    | 'missing_weeks'
    | 'low_attendance'
    | 'inactive'
    | 'consecutive_missing'
    /** Não é problema: carrega a data da última pagela para a linha do tempo. */
    | 'info';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  weeksMissing?: number;
  lastPagelaDate?: string;
}

export class ClubAttendanceAnalysisDto {
  clubId: string;
  clubNumber: number;
  weekday: string;

  period: {
    startDate: string;
    endDate: string;
    totalWeeks: number;
    activeWeeks: number;
    exceptionsCount: number;
    /** `false` quando o ano não tem período letivo cadastrado. */
    hasAcademicPeriod: boolean;
  };

  attendance: {
    weeksWithPagela: number;
    weeksExpected: number;
    weeksMissing: number;
    attendanceRate: number;
    consecutiveWeeksPresent: number;
    consecutiveWeeksMissing: number;
  };

  alerts: ClubAttendanceAlertDto[];

  timeline: AttendanceTimelineWeekDto[];
  timelinePagination: AttendancePaginationDto;

  missingWeeks: MissingWeekDto[];
  missingWeeksPagination: AttendancePaginationDto;

  /** Presente só quando o ano não tem período letivo: explica a resposta vazia. */
  note?: string;
}

export class ClubsAttendanceResponseDto {
  period: {
    year?: number;
    startDate?: string;
    endDate?: string;
  };

  summary: {
    totalClubs: number;
    clubsWithIssues: number;
    totalWeeksMissing: number;
    avgAttendanceRate: number;
  };

  clubs: ClubAttendanceAnalysisDto[];

  criticalAlerts: {
    clubId: string;
    clubNumber: number;
    alertType: string;
    severity: 'critical';
    message: string;
  }[];
}

/**
 * Situação de um clubinho numa semana.
 *
 * `pending` e `partial` já eram devolvidos e não constavam na união antiga —
 * a tela recebia um valor que nunca tinha sido declarado.
 */
export type WeeklyClubStatus =
  | 'ok'
  | 'partial'
  | 'missing'
  | 'pending'
  | 'vacation'
  | 'inactive'
  /** O dia do clubinho nesta semana cai fora do período letivo: nada a cobrar. */
  | 'out_of_period';

export class WeeklyAttendanceClubDto {
  clubId: string;
  clubNumber: number;
  weekday: string;
  hasPagela: boolean;
  /** Só vem quando a semana tem pagela. */
  totalPagelas?: number;
  expectedChildren: number;
  expectedDate: string;
  status: WeeklyClubStatus;
}

export class WeeklyAttendanceDto {
  year: number;
  week: number;
  weekRange: {
    /** `null` quando o ano não tem período letivo cadastrado. */
    start: string | null;
    end: string | null;
  };

  clubs: WeeklyAttendanceClubDto[];
  pagination?: AttendancePaginationDto;

  summary: {
    totalClubs: number;
    clubsActive: number;
    clubsWithPagela: number;
    clubsMissing: number;
    attendanceRate: number;
  };

  /** Presente só na resposta vazia, explicando por que não há semana. */
  note?: string;
  period?: {
    year: number;
    startDate: string;
    endDate: string;
  };
}
