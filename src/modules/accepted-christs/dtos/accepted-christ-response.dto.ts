import { RecordAuthorDto } from 'src/shared/record-author/record-author.dto';
import { DecisionType } from '../enums/decision-type.enum';

/**
 * Decisão no contrato de resposta.
 *
 * A criança entra apenas pelo id: o registro é sobre a decisão, e devolver a
 * criança inteira levaria junto responsável, telefone e endereço — dados que
 * quem acabou de gravar a decisão já tem, e que a resposta não precisa repetir.
 */
export class AcceptedChristResponseDto {
  id: string;
  decision: DecisionType | null;
  childId: string;
  notes: string | null;
  /** Quem registrou; `null` em registros antigos. */
  createdBy: RecordAuthorDto | null;
  createdAt: string;
  updatedAt: string;
}
