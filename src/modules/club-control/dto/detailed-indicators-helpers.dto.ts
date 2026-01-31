import { ClubIndicatorDto } from './club-check-result.dto';

export interface ChildrenInfo {
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
}

export class ClubIndicatorDetailDto {
  clubId: string;
  clubNumber: number;
  weekday: string;
  indicator: ClubIndicatorDto;
  children: ChildrenInfo;
  week: {
    year: number;
    week: number;
    expectedDate: string | null;
  };
}

// Keep this consistent with ClubCheckResultDto
export class WeekdayStatsDto {
  weekday: string;
  totalClubs: number;
  clubsOk: number;
  clubsPending: number;
  clubsPartial: number;
  clubsMissing: number;
  totalChildren: number;
  childrenWithPagela: number;
  childrenMissing: number;
  completionRate: number;
}
