export class ClubStatsItemDto {

  clubId: string;
  clubNumber: number;
  weekday: string;
  time?: string | null;


  address?: {
    city?: string;
    state?: string;
    district?: string;
    street?: string;
  };


  coordinator?: {
    id: string;
    name: string;
  } | null;


  children: {
    total: number;
    active: number;
    byGender: {
      M: number;
      F: number;
    };
    avgAge: number;
    withDecisions: number;
  };


  teachers: {
    total: number;
    active: number;
    list: {
      id: string;
      name: string;
    }[];
  };


  performance: {
    totalPagelas: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    performanceScore: number;
    totalDecisions: number;
  };


  lastActivity?: {
    date: string;
    type: string;
  } | null;


  rank?: number;
}

export class ClubsStatsResponseDto {
  filters: {
    applied: Record<string, any>;
    summary: string;
  };

  summary: {
    totalClubs: number;
    filteredClubs: number;
    totalChildren: number;
    totalTeachers: number;
    avgPerformanceScore: number;
    avgPresenceRate: number;
    totalDecisions: number;
  };

  distribution: {
    byCity: {
      city: string;
      state: string;
      count: number;
      percentage: number;
    }[];
    byWeekday: {
      weekday: string;
      count: number;
      percentage: number;
    }[];
    byCoordinator: {
      coordinatorId: string;
      coordinatorName: string;
      count: number;
      percentage: number;
    }[];
    byPerformance: {
      range: string;
      count: number;
      percentage: number;
    }[];
  };

  clubs: ClubStatsItemDto[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };


  inactiveClubs: {
    total: number;
    list: {
      clubId: string;
      clubNumber: number;
      weekday: string;
      isActive: boolean;
    }[];
  };

  inactiveChildren: {
    total: number;
    fromInactiveClubs: number;
  };
}


