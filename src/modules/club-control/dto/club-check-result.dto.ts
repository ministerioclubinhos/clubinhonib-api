export class ClubCheckResultDto {
  clubId: string;
  clubNumber: number;
  weekday: string | null;
  week: {
    year: number;
    week: number;
    expectedDate: string | null;
  };
  children: {
    total: number;
    activeCount: number;
    inactiveCount: number;
    withPagela: number;
    missing: number;
    missingList: { childId: string; childName: string }[];
    notAttendingCount: number;
    notAttendingList: {
      childId: string;
      childName: string;
      isActive?: boolean;
    }[];
    note: string;
  };
  status: string;
  indicators: ClubIndicatorDto[];
  exception: {
    date: string;
    reason: string;
    type: string;
  } | null;
  period?: {
    year: number;
    startDate: string;
    endDate: string;
  };
  note?: string;
}
export interface ClubIndicatorDto {
  type: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  message: string;
  details?: any;
}
