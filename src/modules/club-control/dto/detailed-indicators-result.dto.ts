import { ClubCheckResultDto } from './club-check-result.dto';

export class DetailedIndicatorsResultDto {
  executiveSummary: {
    week: {
      year: number;
      week: number;
      expectedDate: string | null;
    };
    overall: any;
    children: any;
    indicators: any;
  };
  indicators: {
    byType: Record<string, any[]>;
    critical: any[];
    warning: any[];
  };
  clubs: {
    byStatus: Record<string, ClubCheckResultDto[]>;
    withProblems: ClubCheckResultDto[];
    critical: ClubCheckResultDto[];
    warning: ClubCheckResultDto[];
  };
  statistics: {
    byWeekday: any[];
    overall: any;
  };
  recommendations: string[];
  currentWeek: any;
  inactiveClubs: any[];
  childrenNotAttending: {
    total: number;
    list: any[];
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    clubsWithProblems?: ClubCheckResultDto[];
    clubsCritical?: ClubCheckResultDto[];
  };
}
