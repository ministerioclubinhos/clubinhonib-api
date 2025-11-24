/**
 * DTOs para análise de frequência e alertas de clubes
 */

export class MissingWeekDto {
  year: number;
  week: number;
  expectedDate: string; // Data esperada da pagela (baseado no dia da semana do clube)
  weekRange: {
    start: string; // Início da semana
    end: string; // Fim da semana
  };
  reason: 'no_pagela' | 'club_inactive' | 'vacation_period';
  severity: 'critical' | 'warning' | 'info';
}

export class ClubAttendanceAnalysisDto {
  clubId: string;
  clubNumber: number;
  weekday: string;

  period: {
    startDate: string;
    endDate: string;
    totalWeeks: number;
    activeWeeks: number; // Semanas que o clube deveria funcionar
  };

  attendance: {
    weeksWithPagela: number;
    weeksExpected: number;
    weeksMissing: number;
    attendanceRate: number; // % de semanas com pagela
    consecutiveWeeksPresent: number;
    consecutiveWeeksMissing: number;
  };

  missingWeeks: MissingWeekDto[];

  alerts: {
    type: 'missing_weeks' | 'low_attendance' | 'inactive' | 'consecutive_missing';
    severity: 'critical' | 'warning' | 'info';
    message: string;
    weeksMissing?: number;
    lastPagelaDate?: string;
  }[];

  timeline: {
    year: number;
    week: number;
    date: string;
    hasPagela: boolean;
    totalPagelas?: number;
    presenceRate?: number;
  }[];
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

export class WeeklyAttendanceDto {
  year: number;
  week: number;
  weekRange: {
    start: string;
    end: string;
  };

  clubs: {
    clubId: string;
    clubNumber: number;
    weekday: string;
    hasPagela: boolean;
    totalPagelas?: number;
    expectedDate: string;
    status: 'ok' | 'missing' | 'vacation' | 'inactive';
  }[];

  summary: {
    totalClubs: number;
    clubsActive: number;
    clubsWithPagela: number;
    clubsMissing: number;
    attendanceRate: number;
  };
}

