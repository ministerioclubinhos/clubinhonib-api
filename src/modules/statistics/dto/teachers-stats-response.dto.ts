export class TeacherStatsItemDto {
  teacherId: string;
  name: string;

  club?: {
    id: string;
    number: number;
    weekday: string;
    city: string;
    state: string;
  } | null;

  coordinator?: {
    id: string;
    name: string;
  } | null;

  children: {
    total: number;
    unique: number;
    active: number;
    withDecisions: number;
    avgEngagement: number;
  };

  performance: {
    totalPagelas: number;
    avgPresenceRate: number;
    avgMeditationRate: number;
    avgVerseRate: number;
    effectivenessScore: number;
  };

  lastActivity?: {
    date: string;
    totalPagelas: number;
  } | null;

  isActive: boolean;

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
      range: string;
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
