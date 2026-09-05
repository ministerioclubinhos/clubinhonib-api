import { ClubPeriodEntity } from './entities/club-period.entity';
import { ClubExceptionEntity } from './entities/club-exception.entity';
import {
  ClubExceptionResponseDto,
  ClubPeriodResponseDto,
} from './dto/club-control-contracts.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Um período letivo no contrato público. */
export function toClubPeriodResponse(
  period: ClubPeriodEntity,
): ClubPeriodResponseDto {
  return {
    id: period.id,
    year: period.year,
    startDate: period.startDate,
    endDate: period.endDate,
    description: period.description ?? null,
    isActive: period.isActive,
    createdAt: toIsoString(period.createdAt),
    updatedAt: toIsoString(period.updatedAt),
  };
}

/** Uma exceção de calendário no contrato público. */
export function toClubExceptionResponse(
  exception: ClubExceptionEntity,
): ClubExceptionResponseDto {
  return {
    id: exception.id,
    exceptionDate: exception.exceptionDate,
    reason: exception.reason,
    type: exception.type,
    notes: exception.notes ?? null,
    isActive: exception.isActive,
    isRecurrent: exception.isRecurrent,
    createdAt: toIsoString(exception.createdAt),
    updatedAt: toIsoString(exception.updatedAt),
  };
}
