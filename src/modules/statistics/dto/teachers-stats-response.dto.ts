export class TeacherStatsItemDto {
  // Teacher info
  teacherId: string;
  name: string;

  // Club info
  club?: {
    id: string;
    number: number;
    weekday: string;
    city: string;
    state: string;
  } | null;

  // Coordinator
  coordinator?: {
    id: string;
    name: string;
  } | null;

  // Children stats
  children: {
    total: number;
    unique: number;
    active: number;
    withDecisions: number;
    avgEngagement: number;
  };

  // Performance stats
  performance: {
    totalPagelas: number;
    avgPresenceRate: number;
    avgMeditationRate: number;
    avgVerseRate: number;
    effectivenessScore: number; // 0-100
  };

  // Activity
  lastActivity?: {
    date: string;
    totalPagelas: number;
  } | null;

  isActive: boolean; // Últimos 30 dias

  // Ranking
  rank?: number;
}

export class TeachersStatsResponseDto {
  filters: {
    applied: Record<string, any>;
    summary: string;
  };

  summary: {
    totalTeachers: number;
    filteredTeachers: number;
    activeTeachers: number;
    totalChildren: number;
    avgEffectivenessScore: number;
    avgPresenceRate: number;
  };

  distribution: {
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
    byEffectiveness: {
      range: string; // "0-50", "50-70", "70-85", "85-100"
      count: number;
      percentage: number;
    }[];
  };

  teachers: TeacherStatsItemDto[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
