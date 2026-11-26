import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { MEDITATION_END_WEEKDAY, MEDITATION_START_WEEKDAY } from './constants';
import { MeditationPeriod } from './types';

/**
 * Converte uma data `YYYY-MM-DD` para uma data local.
 *
 * Aceita `Date` porque o driver do MySQL devolve colunas `date` ora como string,
 * ora como `Date`; usar `new Date(str)` interpretaria a string como UTC e
 * deslocaria o dia em fusos negativos, que é o caso do Brasil.
 */
export function parseDateAsLocal(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Formata uma data local como `YYYY-MM-DD`. */
export function formatDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Data de hoje, sem horário, no fuso local. */
export function todayAsLocalDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Garante que o período comece numa segunda e termine numa sexta, como exige a
 * meditação semanal.
 */
export function assertMeditationPeriod(period: MeditationPeriod): void {
  if (period.startDate.getDay() !== MEDITATION_START_WEEKDAY) {
    throw new AppValidationException(
      ErrorCode.INVALID_DATE_RANGE,
      'startDate deve ser uma segunda-feira',
    );
  }

  if (period.endDate.getDay() !== MEDITATION_END_WEEKDAY) {
    throw new AppValidationException(
      ErrorCode.INVALID_DATE_RANGE,
      'endDate deve ser uma sexta-feira',
    );
  }

  if (period.endDate < period.startDate) {
    throw new AppValidationException(
      ErrorCode.INVALID_DATE_RANGE,
      'endDate deve ser posterior a startDate',
    );
  }
}

/** True quando a data está dentro do período, incluindo as pontas. */
export function isWithinPeriod(date: Date, period: MeditationPeriod): boolean {
  return date >= period.startDate && date <= period.endDate;
}

/**
 * Lê e valida o JSON enviado junto do arquivo, com as mesmas regras do
 * ValidationPipe global.
 */
export async function parseAndValidatePayload<T extends object>(
  raw: string | undefined,
  dtoClass: new () => T,
): Promise<T> {
  if (!raw) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'meditationData é obrigatório',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'meditationData deve conter um JSON válido',
    );
  }

  const dto = plainToInstance(dtoClass, parsed);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const message = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join(' | ');

    throw new AppValidationException(
      ErrorCode.VALIDATION_ERROR,
      message || 'Dados inválidos na requisição',
    );
  }

  return dto;
}
