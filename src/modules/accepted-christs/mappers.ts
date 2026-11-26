import { toRecordAuthor } from 'src/shared/record-author/record-author.util';
import { AcceptedChristResponseDto } from './dtos/accepted-christ-response.dto';
import { AcceptedChristShortDto } from './dtos/accepted-christ-short.dto';
import { AcceptedChristEntity } from './entities/accepted-christ.entity';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Decisão no contrato público. */
export function toAcceptedChristResponse(
  entity: AcceptedChristEntity,
  childId: string,
): AcceptedChristResponseDto {
  return {
    id: entity.id,
    decision: entity.decision,
    childId,
    notes: entity.notes ?? null,
    createdBy: toRecordAuthor(entity.createdBy),
    createdAt: toIsoString(entity.createdAt),
    updatedAt: toIsoString(entity.updatedAt),
  };
}

/** Recorte curto, usado pela listagem de crianças. */
export function toAcceptedChristShort(
  entity: AcceptedChristEntity,
): AcceptedChristShortDto {
  return {
    id: entity.id,
    decision: entity.decision,
    createdBy: toRecordAuthor(entity.createdBy),
    createdAt: toIsoString(entity.createdAt),
    updatedAt: toIsoString(entity.updatedAt),
  };
}
