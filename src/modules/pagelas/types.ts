/**
 * Quem está pedindo a operação.
 *
 * Os casos de uso recebem isto, e não a requisição HTTP: quem lê o token é o
 * controller, que é a camada que enxerga o transporte.
 */
export interface PagelaAccessContext {
  role?: string;
  userId?: string | null;
}

import { PagelaLaunchClosedReason } from './enums/pagela-launch-closed-reason.enum';

export type {
  AcademicPeriod,
  AcademicWeek,
} from 'src/shared/academic-week/academic-week.util';

/** Dados que a persistência grava ao criar uma pagela. */
export interface PagelaCreateData {
  childId: string;
  teacherProfileId: string | null;
  referenceDate: string;
  year: number;
  week: number;
  present: boolean;
  didMeditation: boolean;
  recitedVerse: boolean;
  notes: string | null;
  /** Usuário que está lançando. */
  createdByUserId: string | null;
}

/** Campos que a edição pode alterar. Ausente significa "não mexer". */
export interface PagelaUpdateData {
  referenceDate?: string;
  year?: number;
  week?: number;
  present?: boolean;
  didMeditation?: boolean;
  recitedVerse?: boolean;
  notes?: string | null;
  teacherProfileId?: string | null;
  /** Usuário que está alterando. */
  updatedByUserId: string | null;
}

/**
 * A janela de lançamento de pagelas em um dia.
 *
 * Aberta, traz o período em andamento e a semana letiva de hoje. Fechada, traz
 * o motivo e o período que explica a recusa (o próximo ou o último).
 */
export interface PagelaLaunchWindow {
  open: boolean;
  reason: PagelaLaunchClosedReason | null;
  /** Hoje no fuso do Clubinho, em `YYYY-MM-DD`. */
  today: string;
  year: number | null;
  currentWeek: number | null;
  totalWeeks: number | null;
  startDate: string | null;
  endDate: string | null;
}

/** Janela aberta: os campos do período deixam de ser opcionais. */
export interface OpenPagelaLaunchWindow extends PagelaLaunchWindow {
  open: true;
  reason: null;
  year: number;
  currentWeek: number;
  totalWeeks: number;
  startDate: string;
  endDate: string;
}

/** O que a criação ou a edição quer gravar de data e semana. */
export interface PagelaWeekRequest {
  referenceDate?: string;
  year?: number;
  week?: number;
}
