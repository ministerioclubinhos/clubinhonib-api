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
}
