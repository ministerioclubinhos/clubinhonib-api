

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



export class PagelasChartDataDto {
  
  timeSeries?: {
    presence: TimeSeriesDataPoint[];
    meditation: TimeSeriesDataPoint[];
    verseRecitation: TimeSeriesDataPoint[];
    total: TimeSeriesDataPoint[];
  };

  
  byGender?: {
    gender: string;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
  }[];

  
  byAgeGroup?: {
    ageGroup: string; 
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
  }[];

  
  byClub?: {
    clubId: string;
    clubNumber: number;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    uniqueChildren: number;
  }[];

  
  byTeacher?: {
    teacherId: string;
    teacherName: string;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    uniqueChildren: number;
  }[];

  
  byCity?: {
    city: string;
    state: string;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    uniqueChildren: number;
  }[];

  
  byParticipationTime?: {
    timeRange: string; 
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    uniqueChildren: number;
    avgMonthsParticipating: number;
  }[];

  
  activityHeatmap?: {
    week: number;
    year: number;
    present: number;
    meditation: number;
    verse: number;
  }[];

  
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



export class AcceptedChristsChartDataDto {
  
  timeSeries?: MultiSeriesDataPoint[];

  
  byGender?: {
    gender: string;
    total: number;
    accepted: number;
    reconciled: number;
  }[];

  
  byAgeGroup?: {
    ageGroup: string;
    total: number;
    accepted: number;
    reconciled: number;
  }[];

  
  byClub?: {
    clubId: string;
    clubNumber: number;
    total: number;
    accepted: number;
    reconciled: number;
    uniqueChildren: number;
  }[];

  
  byCity?: {
    city: string;
    state: string;
    total: number;
    accepted: number;
    reconciled: number;
    uniqueChildren: number;
  }[];

  
  byParticipationTime?: {
    timeRange: string;
    total: number;
    accepted: number;
    reconciled: number;
    uniqueChildren: number;
    avgMonthsParticipating: number;
  }[];

  
  conversionFunnel?: {
    totalChildren: number;
    childrenWithPagelas: number;
    childrenWithDecisions: number;
    childrenAccepted: number;
    childrenReconciled: number;
    conversionRate: number;
  };

  
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



export class CombinedInsightsDto {
  
  topEngagedChildren?: {
    childId: string;
    childName: string;
    gender: string;
    age: number;
    clubNumber: number | null;
    city?: string | null;
    state?: string | null;
    monthsParticipating?: number;
    engagementScore: number; 
    totalPagelas: number;
    presenceRate: number;
    hasDecision: boolean;
    decisionType?: string | null;
  }[];

  
  clubRankings?: {
    clubId: string;
    clubNumber: number;
    totalChildren: number;
    activeChildren: number;
    avgPresenceRate: number;
    avgMeditationRate: number;
    totalDecisions: number;
    performanceScore: number; 
  }[];

  
  teacherEffectiveness?: {
    teacherId: string;
    teacherName: string;
    totalPagelas: number;
    avgPresenceRate: number;
    avgActivityRate: number;
    childrenWithDecisions: number;
    effectivenessScore: number; 
  }[];

  
  trends?: {
    metric: string;
    trend: 'up' | 'down' | 'stable';
    changePercentage: number;
    forecast?: number;
  }[];
}

