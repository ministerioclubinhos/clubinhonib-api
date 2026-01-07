export class ChildStatsItemDto {
  // Child info
  childId: string;
  name: string;
  gender: string;
  age: number;
  birthDate: string;

  // Participation
  joinedAt?: string | null;
  monthsParticipating: number;
  participationTimeRange: string; // "0-3 meses", etc.

  // Club info
  club?: {
    id: string;
    number: number;
    weekday: string;
  } | null;

  // Address info
  address?: {
    city: string;
    state: string;
    district: string;
  } | null;

  // Statistics
  stats: {
    totalPagelas: number;
    presenceCount: number;
    meditationCount: number;
    verseRecitationCount: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    engagementScore: number; // 0-100
    lastPagelaDate?: string | null;
    consecutiveWeeks: number;
  };

  // Decisions
  decisions: {
    hasDecision: boolean;
    decisionType?: string | null;
    decisionDate?: Date | null;
    totalDecisions: number;
  };

  // Activity status
  isActive: boolean; // Teve pagela nos últimos 30 dias

  // Ranking
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
