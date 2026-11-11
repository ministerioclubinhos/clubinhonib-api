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
    /** Aceitaram + reconciliaram, uma criança por tipo. Não inclui as sem tipo. */
    totalDecisions: number;
    uniqueChildren: number;
    byDecisionType: {
      [key in DecisionType]?: number;
    };
    /** Registros legados sem tipo de decisão; ficam fora de todo total. */
    unspecifiedDecisions: number;
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
