import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AppBusinessException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import {
  CLUB_MEETING_LOCATION_FALLBACK,
  EVENT_PAYLOAD_FIELD,
} from './constants';

/**
 * Lê e valida o JSON enviado junto do arquivo, com as mesmas regras do
 * ValidationPipe global. O controller não decide mais o que é erro de
 * validação: antes, qualquer falha do caso de uso virava 400.
 */
export async function parseAndValidatePayload<T extends object>(
  raw: string | undefined,
  dtoClass: new () => T,
): Promise<T> {
  if (!raw) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      `${EVENT_PAYLOAD_FIELD} é obrigatório.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      `${EVENT_PAYLOAD_FIELD} deve conter um JSON válido.`,
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
      .filter((text) => text.length > 0)
      .join(' | ');

    throw new AppValidationException(
      ErrorCode.VALIDATION_ERROR,
      message || 'Dados inválidos na requisição.',
    );
  }

  return dto;
}

/**
 * Dia do evento, sem hora, para comparar com hoje. A data é gravada como texto
 * ISO: `new Date` sobre a string completa carrega o fuso junto.
 */
export function toEventDay(value: string): Date {
  const [datePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);

  if (!year || !month || !day) {
    const fallback = new Date(value);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }

  return new Date(year, month - 1, day);
}

/** Hoje à meia-noite, no fuso do servidor. */
export function todayAtMidnight(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Posição de cada dia da semana em `Date.getDay()`. */
const WEEKDAY_INDEX: Record<Weekday, number> = {
  [Weekday.MONDAY]: 1,
  [Weekday.TUESDAY]: 2,
  [Weekday.WEDNESDAY]: 3,
  [Weekday.THURSDAY]: 4,
  [Weekday.FRIDAY]: 5,
  [Weekday.SATURDAY]: 6,
};

/**
 * Primeira ocorrência do encontro a partir de hoje: hoje mesmo, quando cai no
 * dia certo, ou o próximo dia da semana correspondente.
 */
export function nextOccurrence(weekday: Weekday, from = new Date()): string {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const distance = (WEEKDAY_INDEX[weekday] - start.getDay() + 7) % 7;
  start.setDate(start.getDate() + distance);

  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');

  return `${start.getFullYear()}-${month}-${day}`;
}

/** Endereço do clubinho em uma linha, ou o texto de reserva. */
export function formatClubLocation(
  address?: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
  } | null,
): string {
  if (!address) return CLUB_MEETING_LOCATION_FALLBACK;

  const streetLine = [address.street, address.number]
    .filter((part) => part?.trim())
    .join(', ');
  const cityLine = [address.city, address.state]
    .filter((part) => part?.trim())
    .join(' - ');

  const parts = [streetLine, address.district?.trim(), cityLine].filter(
    (part) => part && part.length > 0,
  );

  return parts.length > 0 ? parts.join(' · ') : CLUB_MEETING_LOCATION_FALLBACK;
}

/**
 * Recusa alterar ou excluir um encontro de clubinho pela agenda.
 *
 * Esses eventos são mantidos pelo cadastro do clubinho: `SyncClubEventService`
 * regrava título, endereço, dia e horário a cada edição, então qualquer coisa
 * feita aqui seria desfeita na próxima. Pior, a exclusão pela agenda deixaria o
 * clubinho sem encontro até a próxima sincronização — e antes desta trava ela
 * ainda disparava um e-mail de "evento cancelado" para toda a base.
 *
 * Para tirar o encontro do calendário, desative ou exclua o clubinho.
 */
export function assertNotClubMeeting(event: { clubId?: string | null }): void {
  if (!event.clubId) return;

  throw new AppBusinessException(
    ErrorCode.CLUB_MEETING_NOT_EDITABLE,
    'Este é o encontro semanal de um clubinho e é mantido pelo cadastro dele. ' +
      'Para alterar ou remover, edite ou desative o clubinho.',
  );
}
