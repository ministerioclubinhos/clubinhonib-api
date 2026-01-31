export interface PagelaStatsRaw {
  totalPagelas: string;
  presenceCount: string;
  meditationCount: string;
  verseCount: string;
  lastActivity?: string;
  activeChildren?: string;
  activeTeachers?: string;
}

export interface ChildDecisionStatsRaw {
  childId: string;
  lastDecision: string;
  lastDecisionDate: Date;
  totalDecisions: string;
}

export interface ChildStatsRaw {
  clubId: string;
  gender: string;
  total: string;
}

export interface DecisionStatsRaw {
  clubId: string;
  childrenWithDecisions: string;
  totalDecisions: string;
}

export interface TeacherStatsRaw {
  teacherId: string;
  totalPagelas: string;
  uniqueChildren: string;
  presenceCount: string;
  meditationCount: string;
  verseCount: string;
  lastActivity?: string;
}

export interface TeacherDecisionStatsRaw {
  teacherId: string;
  childrenWithDecisions: string;
}

export interface PagelasByTeacherRaw {
  teacherId: string;
  teacherName: string;
  total: string;
  uniqueChildren: string;
  presentCount: string;
  meditationCount: string;
  verseCount: string;
}

export interface AcceptedChristsByCityRaw {
  city: string;
  state: string;
  total: string;
  uniqueChildren: string;
  accepted: string;
  reconciled: string;
}

export interface PagelasWeeklyStatsRaw {
  year: string;
  week: string;
  totalPagelas: string;
  presentCount: string;
  didMeditationCount: string;
  recitedVerseCount: string;
  uniqueChildren: string;
  uniqueTeachers: string;
}

export interface PagelasOverallStatsRaw {
  totalPagelas: string;
  totalChildren: string;
  totalTeachers: string;
  presentCount: string;
  didMeditationCount: string;
  recitedVerseCount: string;
}

export interface PagelasTopPerformerRaw {
  childId: string;
  childName: string;
  presenceCount: string;
  meditationCount: string;
  verseRecitationCount: string;
}

export interface PagelasDemographicsRaw {
  gender: string;
  total: string;
  presentCount: string;
  meditationCount: string;
  verseCount: string;
}

export interface AgeGroupStats {
  ageGroup: string;
  total: number;
  presentCount: number;
  meditationCount: number;
  verseCount: number;
}

export interface AcceptedAgeGroupStats {
  ageGroup: string;
  total: number;
  accepted: number;
  reconciled: number;
}

export interface PagelasByClubRaw {
  clubId: string;
  clubNumber: string;
  total: string;
  totalPagelas?: string;
  uniqueChildren: string;
  activeChildren?: string;
  activeTeachers?: string;
  presentCount: string;
  presenceCount?: string;
  meditationCount: string;
  verseCount: string;
  lastActivity?: string;
}

export interface PagelasTimeSeriesRaw {
  period: string;
  total: string;
  present: string;
  meditation: string;
  verse: string;
}

export interface PagelasByCityRaw {
  city: string;
  state: string;
  total: string;
  uniqueChildren: string;
  presentCount: string;
  meditationCount: string;
  verseCount: string;
}

export interface ParticipationTimeStats {
  timeRange: string;
  total: number;
  presentCount: number;
  meditationCount: number;
  verseCount: number;
  childrenMonths: number[];
}

export interface AcceptedParticipationTimeStats {
  timeRange: string;
  total: number;
  accepted: number;
  reconciled: number;
  childrenMonths: number[];
}

export interface AcceptedChristsOverallStatsRaw {
  totalDecisions: string;
  uniqueChildren: string;
  decision: string;
}

export interface AcceptedChristsByPeriodRaw {
  period: string;
  totalDecisions: string;
  uniqueChildren: string;
  decision: string;
}

export interface AcceptedChristsByGenderRaw {
  gender: string;
  total: string;
  accepted: string;
  reconciled: string;
}

export interface AcceptedChristsByClubRaw {
  clubId: string;
  clubNumber: string;
  total: string;
  totalDecisions: string;
  uniqueChildren: string;
  childrenWithDecisions?: string;
  accepted: string;
  reconciled: string;
}

export interface AcceptedChristsTimeSeriesRaw {
  date: string;
  period: string;
  total: string;
  accepted: string;
  reconciled: string;
}

export interface ChildPagelaStatsRaw {
  childId: string;
  pagelaId: string;
  present: boolean;
  didMeditation: boolean;
  recitedVerse: boolean;
  date: Date;
  totalPagelas: string;
  presenceCount: string;
  meditationCount: string;
  verseCount: string;
  lastActivity: string;
}

export interface TopEngagedChildStatsRaw {
  childId: string;
  childName: string;
  clubNumber: number;
  city?: string;
  state?: string;
  gender?: string;
  birthDate?: Date;
  joinedAt?: Date;
  totalPagelas: string;
  presenceCount: string;
  meditationCount: string;
  verseCount: string;
  engagementScore: number;
}

export interface ClubRankingStatsRaw {
  clubId: string;
  clubNumber: number;
  city: string;
  totalPagelas: string;
  presenceCount: string;
  meditationCount: string;
  activeChildren: string;
  performanceScore: number;
}

// Result Interfaces
export interface ChildrenWithStatsResult {
  children: any[]; // ChildEntity[]
  pagelasStats: Map<string, ChildPagelaStatsRaw>;
  decisionsMap: Map<string, ChildDecisionStatsRaw>;
  totalCount: number;
  filteredCount: number;
  page: number;
  limit: number;
}

export interface ClubsWithStatsResult {
  clubs: any[]; // ClubEntity[]
  childrenResults: ChildStatsRaw[];
  pagelasResults: PagelasByClubRaw[];
  decisionsResults: AcceptedChristsByClubRaw[];
  teachers: any[]; // TeacherProfileEntity[]
  totalCount: number;
  page: number;
  limit: number;
  inactiveClubs: {
    total: number;
    list: {
      clubId: string;
      clubNumber: number;
      weekday: string;
      isActive: boolean;
    }[];
  };
  inactiveChildren: { total: number; fromInactiveClubs: number };
}

export interface TeachersWithStatsResult {
  teachers: any[]; // TeacherProfileEntity[]
  pagelasResults: TeacherStatsRaw[];
  decisionsResults: TeacherDecisionStatsRaw[];
  totalCount: number;
  page: number;
  limit: number;
}
