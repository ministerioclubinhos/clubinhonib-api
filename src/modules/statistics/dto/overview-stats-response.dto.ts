export class OverviewStatsResponseDto {
  summary: {
    totalChildren: number;
    totalClubs: number;
    totalTeachers: number;
    activeChildrenThisMonth: number;
    activeTeachersThisMonth: number;
    inactiveChildren: number; // ⭐ Total de crianças desativadas
    inactiveClubs: number; // ⭐ Total de clubinhos desativados
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
  // ⭐ NOVO: Métricas adicionais de engajamento
  engagement?: {
    avgEngagementScore: number; // Score médio de engajamento das crianças ativas
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
      last7Days: number; // Total de pagelas dos últimos 7 dias
      last30Days: number; // Total de pagelas dos últimos 30 dias
    };
  };
  // ⭐ NOVO: Alertas e indicadores
  indicators?: {
    clubsWithLowAttendance: number; // Clubes com presença < 70%
    childrenWithLowEngagement: number; // Crianças com engajamento < 50%
    clubsMissingPagelas: number; // Clubes sem pagela na semana atual
    growthRate: {
      children: number; // % de crescimento de crianças nos últimos 3 meses
      decisions: number; // % de crescimento de decisões nos últimos 3 meses
    };
  };
  // ⭐ NOVO: Distribuições rápidas
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

