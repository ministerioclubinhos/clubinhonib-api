import { PagelaEntity } from './entities/pagela.entity';
import { PagelaResponseDto } from './dto/pagela-response.dto';

/** Data em ISO, venha ela como `Date` do banco ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Contrato de resposta de `/pagelas`. */
export function toPagelaResponse(pagela: PagelaEntity): PagelaResponseDto {
  return {
    id: pagela.id,
    childId: pagela.child?.id ?? '',
    teacherProfileId: pagela.teacher?.id ?? null,
    referenceDate: pagela.referenceDate,
    year: pagela.year,
    week: pagela.week,
    present: pagela.present,
    didMeditation: pagela.didMeditation,
    recitedVerse: pagela.recitedVerse,
    notes: pagela.notes ?? null,
    createdAt: toIsoString(pagela.createdAt),
    updatedAt: toIsoString(pagela.updatedAt),
  };
}
