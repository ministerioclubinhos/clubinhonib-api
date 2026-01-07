export class WeeklyPagelaStatsDto {
  year: number;
  week: number;
  totalPagelas: number;
  presentCount: number;
  didMeditationCount: number;
  recitedVerseCount: number;
  presenceRate: number;
  meditationRate: number;
  verseRecitationRate: number;
  uniqueChildren: number;
  uniqueTeachers: number;
}

export class PagelasStatsResponseDto {
  period: {
    startDate?: string;
    endDate?: string;
    year?: number;
    week?: number;
  };
  overall: {
    totalPagelas: number;
    totalChildren: number;
    totalTeachers: number;
    averagePresenceRate: number;
    averageMeditationRate: number;
    averageVerseRecitationRate: number;
  };
  byWeek?: WeeklyPagelaStatsDto[];
  topPerformers?: {
    childId: string;
    childName: string;
    presenceCount: number;
    meditationCount: number;
    verseRecitationCount: number;
  }[];
}
