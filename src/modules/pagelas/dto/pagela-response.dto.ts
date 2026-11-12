import { RecordAuthorDto } from 'src/shared/record-author/record-author.dto';

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
  /** Quem lançou; `null` em registros antigos. */
  createdBy: RecordAuthorDto | null;
  /** Quem alterou por último. */
  updatedBy: RecordAuthorDto | null;
  createdAt: string;
  updatedAt: string;
}
