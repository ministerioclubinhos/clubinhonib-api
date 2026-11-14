import { ClubPeriodEntity } from './entities/club-period.entity';
import { ClubExceptionEntity } from './entities/club-exception.entity';
import {
  ClubExceptionResponseDto,
  ClubExceptionWindowDto,
  ClubPeriodResponseDto,
  ClubPeriodWindowDto,
} from './dto/club-control-contracts.dto';

/**
 * Dia de calendário em `YYYY-MM-DD`.
 *
 * A coluna é `date`, mas o driver pode devolver `Date`; nesse caso a conversão
 * usa as partes locais. `toISOString` levaria o dia para UTC e, em fuso
 * negativo, um período que começa dia 07 voltaria como dia 06.
 */
function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  return String(value).split('T')[0];
}

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

/** Um período letivo reduzido à janela que o calendário usa. */
export function toClubPeriodWindow(
  period: ClubPeriodEntity,
): ClubPeriodWindowDto {
  return {
    year: period.year,
    startDate: toDateOnly(period.startDate),
    endDate: toDateOnly(period.endDate),
  };
}

/** Uma exceção reduzida à janela que o calendário usa. */
export function toClubExceptionWindow(
  exception: ClubExceptionEntity,
): ClubExceptionWindowDto {
  return {
    exceptionDate: toDateOnly(exception.exceptionDate),
    isRecurrent: exception.isRecurrent,
  };
}
