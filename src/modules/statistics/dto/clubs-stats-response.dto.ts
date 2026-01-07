export class ClubStatsItemDto {
  // Club info
  clubId: string;
  clubNumber: number;
  weekday: string;
  time?: string | null;

  // Address
  address: {
    city: string;
    state: string;
    district: string;
    street: string;
  };

  // Coordinator
  coordinator?: {
    id: string;
    name: string;
  } | null;

  // Children stats
  children: {
    total: number;
    active: number; // Últimos 30 dias
    byGender: {
      M: number;
      F: number;
    };
    avgAge: number;
    withDecisions: number;
  };

  // Teachers stats
  teachers: {
    total: number;
    active: number;
    list: {
      id: string;
      name: string;
    }[];
  };

  // Performance stats
  performance: {
    totalPagelas: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    performanceScore: number; // 0-100
    totalDecisions: number;
  };

  // Activity
  lastActivity?: {
    date: string;
    type: string;
  } | null;

  // Ranking
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
      range: string; // "0-50", "50-70", "70-85", "85-100"
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

  // ⭐ NOVO: Informações sobre clubinhos e crianças desativadas
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
