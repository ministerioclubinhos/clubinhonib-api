export class ClubCheckResultDto {
  clubId: string;
  clubNumber: number;
  weekday: string | null;
  week: {
    year: number;
    week: number;
    expectedDate: string | null;
  };
  children: {
    total: number;
    activeCount: number;
    inactiveCount: number;
    withPagela: number;
    missing: number;
    missingList: { childId: string; childName: string }[];
    notAttendingCount: number;
    notAttendingList: {
      childId: string;
      childName: string;
      isActive?: boolean;
    }[];
    note: string;
  };
  status: string;
  indicators: ClubIndicatorDto[];
  exception: {
    date: string;
    reason: string;
    type: string;
  } | null;
  period?: {
    year: number;
    startDate: string;
    endDate: string;
  };
  note?: string;
}
/** Uma criança listada no detalhe de um indicador. */
export interface IndicatorChildDto {
  childId: string;
  childName: string;
  isActive: boolean;
  /** Por que ela está nesta lista. */
  reason: string;
}

/**
 * O detalhe que acompanha um indicador.
 *
 * Era `any`. Cada tipo de indicador preenche um subconjunto destes campos — daí
 * todos serem opcionais —, mas o conjunto é fechado: um campo novo em
 * `club-indicators.service.ts` passa a exigir declaração aqui, em vez de
 * aparecer na tela sem ninguém ter decidido.
 */
export interface ClubIndicatorDetailsDto {
  totalChildren?: number;
  childrenWithPagela?: number;
  childrenMissing?: number;
  childrenNotAttending?: number;
  childrenList?: IndicatorChildDto[];
  completionRate?: number;
  missingRate?: number;
  isPerfect?: boolean;
  needsAttention?: boolean;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  lastPagelaDate?: string | null;
  possibleIssue?: string;
  /** Presente nos indicadores de exceção de calendário. */
  exceptionDate?: string;
  reason?: string;
  type?: string;
  isRecurrent?: boolean;
  note?: string;
}

export interface ClubIndicatorDto {
  type: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  message: string;
  details?: ClubIndicatorDetailsDto;
}
