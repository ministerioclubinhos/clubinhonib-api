

export class ClubDetailedStatsDto {
  clubInfo: {
    clubId: string;
    clubNumber: number;
    weekday: string;
    time?: string;
    address: {
      street: string;
      city: string;
      state: string;
      district: string;
    };
    coordinator?: {
      id: string;
      name: string;
    };
  };

  summary: {
    totalChildren: number;
    activeChildren: number;
    totalTeachers: number;
    activeTeachers: number;
    totalPagelas: number;
    totalDecisions: number;
    avgPresenceRate: number;
    avgMeditationRate: number;
    avgVerseRate: number;
  };

  children: {
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
    topEngaged: {
      childId: string;
      childName: string;
      age: number;
      engagementScore: number;
      totalPagelas: number;
      hasDecision: boolean;
    }[];
    newThisMonth: number;
    leftThisMonth: number;
  };

  performance: {
    thisWeek: {
      date: string;
      pagelas: number;
      presenceRate: number;
      decisions: number;
    };
    thisMonth: {
      pagelas: number;
      presenceRate: number;
      meditationRate: number;
      decisions: number;
    };
    trend: {
      direction: 'up' | 'down' | 'stable';
      percentageChange: number;
      comparedTo: 'last_month';
    };
  };

  timeline: {
    date: string;
    pagelas: number;
    presence: number;
    meditation: number;
    verse: number;
    decisions: number;
  }[];

  teachers: {
    teacherId: string;
    teacherName: string;
    totalPagelas: number;
    avgPresenceRate: number;
    uniqueChildren: number;
  }[];
}



export class ChildDetailedStatsDto {
  childInfo: {
    childId: string;
    name: string;
    age: number;
    gender: string;
    birthDate: string;
    joinedAt?: string;
    monthsParticipating: number;
    club?: {
      id: string;
      number: number;
    };
    address?: {
      city: string;
      state: string;
      district: string;
    };
  };

  summary: {
    totalPagelas: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
    engagementScore: number;
    rank: number; 
    totalRank: number; 
  };

  decisions: {
    hasDecision: boolean;
    decisionType?: string;
    decisionDate?: Date;
    notes?: string;
  }[];

  attendance: {
    consecutiveWeeks: number;
    missedLastWeek: boolean;
    attendancePattern: {
      week: number;
      year: number;
      present: boolean;
      didMeditation: boolean;
      recitedVerse: boolean;
    }[];
  };

  progress: {
    firstWeek: {
      date: string;
      presenceRate: number;
      meditationRate: number;
    };
    lastMonth: {
      presenceRate: number;
      meditationRate: number;
      verseRecitationRate: number;
    };
    improvement: {
      presence: number;
      meditation: number;
      verse: number;
    };
  };

  timeline: {
    date: string;
    week: number;
    year: number;
    present: boolean;
    didMeditation: boolean;
    recitedVerse: boolean;
    teacher?: string;
    notes?: string;
  }[];
}



export class CityDetailedStatsDto {
  cityInfo: {
    city: string;
    state: string;
    district?: string;
  };

  summary: {
    totalClubs: number;
    totalChildren: number;
    activeChildren: number;
    totalTeachers: number;
    totalPagelas: number;
    totalDecisions: number;
    avgPresenceRate: number;
  };

  clubs: {
    clubId: string;
    clubNumber: number;
    weekday: string;
    totalChildren: number;
    activeChildren: number;
    avgPresenceRate: number;
    performanceScore: number;
  }[];

  demographics: {
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
    avgAge: number;
  };

  performance: {
    thisMonth: {
      pagelas: number;
      presenceRate: number;
      decisions: number;
    };
    comparisonToState: {
      presenceRate: number; 
      meditationRate: number;
      decisionsRate: number;
    };
  };

  timeline: {
    month: string;
    totalPagelas: number;
    avgPresenceRate: number;
    decisions: number;
  }[];

  neighborhoods: {
    district: string;
    totalChildren: number;
    totalClubs: number;
    avgPresenceRate: number;
  }[];
}



export class TeacherDetailedStatsDto {
  teacherInfo: {
    teacherId: string;
    name: string;
    club?: {
      id: string;
      number: number;
    };
  };

  summary: {
    totalPagelas: number;
    uniqueChildren: number;
    avgPresenceRate: number;
    avgMeditationRate: number;
    avgVerseRate: number;
    effectivenessScore: number;
  };

  children: {
    childId: string;
    childName: string;
    age: number;
    totalPagelas: number;
    presenceRate: number;
    engagementScore: number;
    hasDecision: boolean;
  }[];

  performance: {
    thisMonth: {
      pagelas: number;
      avgPresenceRate: number;
    };
    trend: {
      direction: 'up' | 'down' | 'stable';
      percentageChange: number;
    };
  };

  timeline: {
    date: string;
    pagelas: number;
    avgPresenceRate: number;
  }[];

  comparison: {
    averageInClub: {
      presenceRate: number;
      meditationRate: number;
    };
    yourPerformance: {
      presenceRate: number;
      meditationRate: number;
    };
    ranking: {
      position: number;
      totalTeachers: number;
    };
  };
}



export class ComparativeStatsDto {
  comparison: {
    clubs?: {
      clubId: string;
      clubNumber: number;
      metrics: {
        totalChildren: number;
        presenceRate: number;
        meditationRate: number;
        decisionsCount: number;
        performanceScore: number;
      };
    }[];
    cities?: {
      city: string;
      state: string;
      metrics: {
        totalClubs: number;
        totalChildren: number;
        presenceRate: number;
        decisionsCount: number;
      };
    }[];
    teachers?: {
      teacherId: string;
      teacherName: string;
      metrics: {
        totalPagelas: number;
        presenceRate: number;
        effectivenessScore: number;
      };
    }[];
    timeComparison?: {
      period: string;
      metrics: {
        pagelas: number;
        presenceRate: number;
        decisions: number;
      };
    }[];
  };

  rankings: {
    type: 'clubs' | 'cities' | 'teachers';
    items: {
      id: string;
      name: string;
      score: number;
      rank: number;
    }[];
  };
}



export class TrendsAnalysisDto {
  overview: {
    period: string;
    totalPagelas: number;
    totalDecisions: number;
    avgPresenceRate: number;
  };

  trends: {
    metric: string;
    current: number;
    previous: number;
    change: number;
    changePercentage: number;
    trend: 'up' | 'down' | 'stable';
    forecast?: number;
  }[];

  patterns: {
    bestDay: string;
    bestMonth: string;
    peakHours?: string;
    seasonality: {
      period: string;
      avgValue: number;
    }[];
  };

  predictions: {
    nextMonth: {
      expectedPagelas: number;
      expectedPresenceRate: number;
      expectedDecisions: number;
      confidence: number;
    };
  };

  anomalies: {
    date: string;
    metric: string;
    expectedValue: number;
    actualValue: number;
    deviation: number;
    type: 'spike' | 'drop';
  }[];
}



export class ConsolidatedReportDto {
  reportInfo: {
    generatedAt: Date;
    period: {
      startDate: string;
      endDate: string;
    };
    filters: Record<string, any>;
  };

  executiveSummary: {
    totalChildren: number;
    activeChildren: number;
    totalClubs: number;
    totalPagelas: number;
    totalDecisions: number;
    avgPresenceRate: number;
    avgMeditationRate: number;
    keyHighlights: string[];
  };

  byDimension: {
    clubs: any[];
    cities: any[];
    teachers: any[];
    children: any[];
  };

  achievements: {
    topClub: {
      id: string;
      number: number;
      score: number;
    };
    topChild: {
      id: string;
      name: string;
      score: number;
    };
    topTeacher: {
      id: string;
      name: string;
      score: number;
    };
    topCity: {
      city: string;
      state: string;
      score: number;
    };
  };

  recommendations: {
    category: string;
    priority: 'high' | 'medium' | 'low';
    message: string;
    action: string;
  }[];
}

