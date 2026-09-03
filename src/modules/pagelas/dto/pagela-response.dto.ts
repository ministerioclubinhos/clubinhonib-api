/** Contrato de resposta de `/pagelas`. */
export class PagelaResponseDto {
  id: string;
  childId: string;
  teacherProfileId: string | null;
  /** Data do encontro, em `YYYY-MM-DD`. */
  referenceDate: string;
  year: number;
  week: number;
  present: boolean;
  didMeditation: boolean;
  recitedVerse: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
