export class ChildStatsItemDto {
  
  childId: string;
  name: string;
  gender: string;
  age: number;
  birthDate: string;

  
  joinedAt?: string | null;
  monthsParticipating: number;
  participationTimeRange: string; 

  
  club?: {
    id: string;
    number: number;
    weekday: string;
  } | null;

  
  address?: {
    city: string;
    state: string;
    district: string;
  } | null;

  
  stats: {
    totalPagelas: number;
    presenceCount: number;
    meditationCount: number;
    verseRecitationCount: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    engagementScore: number; 
    lastPagelaDate?: string | null;
    consecutiveWeeks: number;
  };

  
  decisions: {
    hasDecision: boolean;
    decisionType?: string | null;
    decisionDate?: Date | null;
    totalDecisions: number;
  };

  
  isActive: boolean; 
  
  
  rank?: number;
}

export class ChildrenStatsResponseDto {
  filters: {
    applied: Record<string, any>;
    summary: string;
  };

  summary: {
    totalChildren: number;
    filteredChildren: number;
    avgAge: number;
    avgEngagementScore: number;
    avgPresenceRate: number;
    childrenWithDecisions: number;
    activeChildren: number;
  };

  distribution: {
    byGender: {
      gender: string;
      count: number;
      percentage: number;
    }[];
    byAgeGroup: {
      ageGroup: string;
      count: number;
      percentage: number;
    }[];
    byClub: {
      clubId: string;
      clubNumber: number;
      count: number;
      percentage: number;
    }[];
    byCity: {
      city: string;
      state: string;
      count: number;
      percentage: number;
    }[];
    byParticipationTime: {
      timeRange: string;
      count: number;
      percentage: number;
    }[];
  };

  children: ChildStatsItemDto[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}


