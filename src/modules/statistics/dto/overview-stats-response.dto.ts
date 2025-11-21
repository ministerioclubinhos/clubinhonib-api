export class OverviewStatsResponseDto {
  summary: {
    totalChildren: number;
    totalClubs: number;
    totalTeachers: number;
    activeChildrenThisMonth: number;
    activeTeachersThisMonth: number;
  };
  pagelas: {
    thisWeek: {
      total: number;
      presenceRate: number;
      meditationRate: number;
      verseRecitationRate: number;
    };
    thisMonth: {
      total: number;
      presenceRate: number;
      meditationRate: number;
      verseRecitationRate: number;
    };
    lastSixWeeks: {
      week: number;
      year: number;
      total: number;
      presenceRate: number;
    }[];
  };
  acceptedChrists: {
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    byDecisionType: {
      [key: string]: number;
    };
    lastSixMonths: {
      month: string;
      total: number;
    }[];
  };
}

