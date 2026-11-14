import { ClubWeekStatus } from './constants';

/** Uma criança que ficou sem pagela na semana. */
export interface MissingChild {
  childId: string;
  childName: string;
}

/**
 * O que um clubinho deixou pendente numa semana.
 *
 * É o recorte que os avisos precisam do `ClubCheckResultDto`, que traz muito
 * mais coisa — indicadores, crianças que não frequentam, dados do período.
 */
export interface ClubWeekPendency {
  clubId: string;
  clubNumber: number;
  status: ClubWeekStatus;
  /** Data em que o clubinho deveria ter acontecido, em `YYYY-MM-DD`. */
  expectedDate: string | null;
  totalChildren: number;
  withPagela: number;
  missing: MissingChild[];
}

/**
 * Uma exceção de calendário no recorte que o resumo semanal usa.
 *
 * Não é a entidade: o cálculo do quadro precisa da data, do motivo e de saber
 * se ela repete todo ano — e nada mais. Assim a regra fica testável sem banco.
 */
export interface ClubWeekException {
  /** `YYYY-MM-DD`. */
  exceptionDate: string;
  reason: string;
  isRecurrent: boolean;
}
