import { DecisionType } from 'src/modules/accepted-christs/enums/decision-type.enum';

export class AcceptedChristPeriodStatsDto {
  period: string;
  totalDecisions: number;
  byDecisionType: {
    [key in DecisionType]?: number;
  };
  uniqueChildren: number;
}

export class AcceptedChristsStatsResponseDto {
  period: {
    startDate?: string;
    endDate?: string;
  };
  overall: {
    totalDecisions: number;
    uniqueChildren: number;
    byDecisionType: {
      [key in DecisionType]?: number;
    };
  };
  byPeriod?: AcceptedChristPeriodStatsDto[];
  recentDecisions?: {
    id: string;
    childId: string;
    childName: string;
    decision: DecisionType | null;
    createdAt: Date;
    notes?: string | null;
  }[];
}
