// ============= GENERIC CHART DATA STRUCTURES =============

export interface ChartDataPoint {
  label: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface MultiSeriesDataPoint {
  date: string;
  series: {
    [key: string]: number;
  };
}

// ============= PAGELAS CHART DATA =============

export class PagelasChartDataDto {
  // Time series data (for line/area charts)
  timeSeries?: {
    presence: TimeSeriesDataPoint[];
    meditation: TimeSeriesDataPoint[];
    verseRecitation: TimeSeriesDataPoint[];
    total: TimeSeriesDataPoint[];
  };

  // By gender (for pie/bar charts)
  byGender?: {
    gender: string;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
  }[];

  // By age group (for bar charts)
  byAgeGroup?: {
    ageGroup: string; // "0-5", "6-10", "11-15", "16+"
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
  }[];

  // By club (for comparison charts)
  byClub?: {
    clubId: string;
    clubNumber: number;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    uniqueChildren: number;
  }[];

  // By teacher (for ranking charts)
  byTeacher?: {
    teacherId: string;
    teacherName: string;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    uniqueChildren: number;
  }[];

  // By city (for geographic visualization)
  byCity?: {
    city: string;
    state: string;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    uniqueChildren: number;
  }[];

  // By participation time (for retention analysis)
  byParticipationTime?: {
    timeRange: string; // "0-3 meses", "3-6 meses", "6-12 meses", "1+ ano"
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    uniqueChildren: number;
    avgMonthsParticipating: number;
  }[];

  // Heatmap data (week vs activity)
  activityHeatmap?: {
    week: number;
    year: number;
    present: number;
    meditation: number;
    verse: number;
  }[];

  // Comparison data (current vs previous period)
  comparison?: {
    current: {
      period: string;
      total: number;
      presenceRate: number;
      meditationRate: number;
      verseRecitationRate: number;
    };
    previous: {
      period: string;
      total: number;
      presenceRate: number;
      meditationRate: number;
      verseRecitationRate: number;
    };
    change: {
      total: number;
      presenceRate: number;
      meditationRate: number;
      verseRecitationRate: number;
    };
  };
}

// ============= ACCEPTED CHRISTS CHART DATA =============

export class AcceptedChristsChartDataDto {
  // Time series by decision type (for stacked charts)
  timeSeries?: MultiSeriesDataPoint[];

  // By gender (for pie/bar charts)
  byGender?: {
    gender: string;
    total: number;
    accepted: number;
    reconciled: number;
  }[];

  // By age group (for bar charts)
  byAgeGroup?: {
    ageGroup: string;
    total: number;
    accepted: number;
    reconciled: number;
  }[];

  // By club (for comparison charts)
  byClub?: {
    clubId: string;
    clubNumber: number;
    total: number;
    accepted: number;
    reconciled: number;
    uniqueChildren: number;
  }[];

  // By city (for geographic visualization)
  byCity?: {
    city: string;
    state: string;
    total: number;
    accepted: number;
    reconciled: number;
    uniqueChildren: number;
  }[];

  // By participation time
  byParticipationTime?: {
    timeRange: string;
    total: number;
    accepted: number;
    reconciled: number;
    uniqueChildren: number;
    avgMonthsParticipating: number;
  }[];

  // Funnel data (for conversion analysis)
  conversionFunnel?: {
    totalChildren: number;
    childrenWithPagelas: number;
    childrenWithDecisions: number;
    childrenAccepted: number;
    childrenReconciled: number;
    conversionRate: number;
  };

  // Comparison data
  comparison?: {
    current: {
      period: string;
      total: number;
      accepted: number;
      reconciled: number;
    };
    previous: {
      period: string;
      total: number;
      accepted: number;
      reconciled: number;
    };
    change: {
      total: number;
      accepted: number;
      reconciled: number;
    };
  };
}

// ============= COMBINED INSIGHTS =============

export class CombinedInsightsDto {
  // Engagement score per child
  topEngagedChildren?: {
    childId: string;
    childName: string;
    gender: string;
    age: number;
    clubNumber: number | null;
    city?: string | null;
    state?: string | null;
    monthsParticipating?: number;
    engagementScore: number; // 0-100
    totalPagelas: number;
    presenceRate: number;
    hasDecision: boolean;
    decisionType?: string | null;
  }[];

  // Club performance ranking
  clubRankings?: {
    clubId: string;
    clubNumber: number;
    totalChildren: number;
    activeChildren: number;
    avgPresenceRate: number;
    avgMeditationRate: number;
    totalDecisions: number;
    performanceScore: number; // 0-100
  }[];

  // Teacher effectiveness
  teacherEffectiveness?: {
    teacherId: string;
    teacherName: string;
    totalPagelas: number;
    avgPresenceRate: number;
    avgActivityRate: number;
    childrenWithDecisions: number;
    effectivenessScore: number; // 0-100
  }[];

  // Trends and predictions
  trends?: {
    metric: string;
    trend: 'up' | 'down' | 'stable';
    changePercentage: number;
    forecast?: number;
  }[];
}
