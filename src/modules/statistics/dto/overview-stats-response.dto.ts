export class OverviewStatsResponseDto {
  summary: {
    totalChildren: number;
    totalClubs: number;
    totalTeachers: number;
    activeChildrenThisMonth: number;
    activeTeachersThisMonth: number;
    inactiveChildren: number; 
    inactiveClubs: number; 
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
  
  engagement?: {
    avgEngagementScore: number; 
    topPerformingClubs: {
      clubId: string;
      clubNumber: number;
      performanceScore: number;
      city: string;
    }[];
    topEngagedChildren: {
      childId: string;
      name: string;
      engagementScore: number;
      clubNumber: number;
    }[];
    recentActivity: {
      last7Days: number; 
      last30Days: number; 
    };
  };
  
  indicators?: {
    clubsWithLowAttendance: number; 
    childrenWithLowEngagement: number; 
    clubsMissingPagelas: number; 
    growthRate: {
      children: number; 
      decisions: number; 
    };
  };
  
  quickStats?: {
    childrenByGender: {
      M: number;
      F: number;
    };
    clubsByState: {
      state: string;
      count: number;
    }[];
    topCities: {
      city: string;
      state: string;
      totalChildren: number;
      totalClubs: number;
    }[];
  };
}

