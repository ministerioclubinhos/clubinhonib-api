/**
 * Tipos compartilhados pelas consultas de estatística.
 */

/** O que basta saber de uma criança para dizer se ela estava matriculada. */
export interface EnrollmentRecord {
  /** `YYYY-MM-DD`; `null` quando o cadastro não tem data de entrada. */
  joinedAt: string | null;
  isActive: boolean;
  /**
   * `YYYY-MM-DD` do dia em que foi desativada; `null` enquanto ativa.
   *
   * Para quem foi desativada antes de a coluna existir, quem monta o registro
   * preenche com o dia da última alteração do cadastro.
   */
  deactivationDay: string | null;
}

/** Uma criança que pode ser esperada no dia do clubinho dela. */
export interface ExpectedChild extends EnrollmentRecord {
  id: string;
  clubId: string;
  /** Dia da semana do clubinho (`monday` … `sunday`). */
  clubWeekday: string;
}

/** A criança esperada com o que os agrupamentos precisam. */
export interface ExpectedChildRow extends ExpectedChild {
  gender: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  city: string | null;
  state: string | null;
}

/** Uma semana letiva e os limites do período a que pertence. */
export interface ExpectedWeek {
  year: number;
  week: number;
  /** Segunda-feira da semana, `YYYY-MM-DD`. */
  weekStart: string;
  periodStart: string;
  periodEnd: string;
}

/** Um dia sem clubinho (feriado, recesso). */
export interface ExceptionDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Vale para o mesmo dia e mês de qualquer ano. */
  isRecurrent: boolean;
}

/** O recorte de datas em que uma presença pode ser esperada. */
export interface ExpectedWindow {
  /** Hoje, `YYYY-MM-DD`, no fuso do Clubinho. */
  today: string;
  startDate?: string;
  endDate?: string;
  exceptions: readonly ExceptionDay[];
}

/** Quanto se esperava de um grupo no recorte. */
export interface ExpectedSummary {
  /** Presenças esperadas: uma por criança matriculada por dia de clubinho. */
  slots: number;
  /** Crianças distintas com ao menos uma presença esperada. */
  children: number;
}

/** Filtros que recortam **quais crianças** entram numa estatística. */
export interface ChildScopeFilters {
  clubId?: string;
  clubIds?: readonly string[];
  coordinatorId?: string;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  city?: string;
  state?: string;
  district?: string;
  joinedAfter?: string;
  joinedBefore?: string;
}

/** Recorte completo de uma conta de presenças esperadas. */
export interface ExpectedFilters extends ChildScopeFilters {
  year?: number;
  week?: number;
  startDate?: string;
  endDate?: string;
}

/** Semana letiva corrente, ou `null` fora do período letivo. */
export interface CurrentAcademicWeek {
  year: number;
  week: number;
}

/** Contagens de um clubinho no recorte, antes de virarem taxas. */
export interface ClubPerformanceCounts {
  presenceCount: number;
  /** Presenças esperadas no recorte (denominador da presença). */
  expectedPresences: number;
  meditationCount: number;
  totalPagelas: number;
  /** Crianças distintas com ao menos uma presença no recorte. */
  activeChildren: number;
  /** Crianças distintas esperadas no recorte. */
  expectedChildren: number;
  /** Crianças distintas com decisão registrada no recorte. */
  childrenWithDecisions: number;
}

/** As taxas e o índice de desempenho de um clubinho, de 0 a 100. */
export interface ClubPerformance {
  presenceRate: number;
  meditationRate: number;
  activityRate: number;
  decisionRate: number;
  performanceScore: number;
  /**
   * Havia o que medir no recorte: alguém era esperado ou alguma pagela foi
   * lançada. Clubinho sem nenhum dos dois não entra nas médias.
   */
  measured: boolean;
}

/** Decisões de um clubinho no recorte. */
export interface ClubDecisionCounts {
  /** Aceitaram + reconciliaram, uma criança por tipo. */
  totalDecisions: number;
  /** Crianças distintas com alguma decisão tipada. */
  childrenWithDecisions: number;
}
