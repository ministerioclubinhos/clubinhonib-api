/**
 * Response DTOs para o módulo de controle de clubes
 */

export class ClubControlWeeklyCheckDto {
  clubId: string;
  clubNumber: number;
  weekday: string;

  week: {
    year: number;
    week: number;
    expectedDate: string;
  };

  children: {
    total: number; // Total de crianças cadastradas no clube
    withPagela: number; // Crianças que tiveram pagela
    missing: number; // Crianças SEM pagela
    missingList: {
      childId: string;
      childName: string;
    }[];
  };

  status: 'ok' | 'partial' | 'missing' | 'exception';

  alerts: {
    type: 'all_ok' | 'some_missing' | 'no_pagela' | 'exception';
    severity: 'success' | 'warning' | 'critical' | 'info';
    message: string;
  }[];

  isException: boolean;
  exceptionReason?: string | null;
}

export class ClubControlDashboardDto {
  period: {
    year: number;
    week: number;
    weekRange: {
      start: string;
      end: string;
    };
  };

  summary: {
    totalClubs: number;
    clubsOk: number;
    clubsPartial: number;
    clubsMissing: number;
    clubsException: number;
    overallCompleteness: number; // % de clubes que lançaram todas as pagelas
  };

  clubs: ClubControlWeeklyCheckDto[];

  criticalAlerts: {
    clubId: string;
    clubNumber: number;
    message: string;
    missingChildren: number;
  }[];
}

export class ClubControlHistoryDto {
  clubId: string;
  clubNumber: number;

  period: {
    startDate: string;
    endDate: string;
  };

  history: {
    year: number;
    week: number;
    expectedDate: string;
    status: string;
    totalChildren: number;
    childrenWithPagela: number;
    completeness: number; // %
    alerts: string[];
  }[];

  statistics: {
    totalWeeks: number;
    weeksOk: number;
    weeksPartial: number;
    weeksMissing: number;
    avgCompleteness: number;
    consecutiveOk: number;
    consecutiveMissing: number;
  };
}

export class ClubPeriodResponseDto {
  id: string;
  clubId: string;
  clubNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  description?: string;
  isActive: boolean;
  totalWeeks: number;
}

export class ClubExceptionResponseDto {
  id: string;
  clubId: string;
  clubNumber: number;
  exceptionDate: string;
  reason: string;
  type: string;
  notes?: string;
  isActive: boolean;
}
