import { RecordAuthorDto } from 'src/shared/record-author/record-author.dto';
export class AcceptedChristShortDto {
  id: string;
  decision: 'ACCEPTED' | 'RECONCILED' | null;
  /** Quem registrou; `null` em registros antigos. */
  createdBy: RecordAuthorDto | null;
  createdAt: string;
  updatedAt: string;
}
