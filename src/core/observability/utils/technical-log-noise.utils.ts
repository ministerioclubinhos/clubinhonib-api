import {
  CLIENT_ERROR_MAX_STATUS,
  CLIENT_ERROR_MIN_STATUS,
  CLIENT_ERROR_NOISE_STATUSES,
  MESSAGE_SHAPE_PATTERNS,
  REPEAT_WINDOW_MAX_KEYS,
  UNMATCHED_ROUTE_STATUS,
} from '../constants';
import { ClosedRepeatWindow, ObservabilityRecord } from '../types';

/** Se uma resposta 4xx merece registro técnico (ver o filtro em `constants`). */
export function isPersistedClientError(
  statusCode: number,
  handlerName: string | null | undefined,
): boolean {
  if (
    statusCode < CLIENT_ERROR_MIN_STATUS ||
    statusCode > CLIENT_ERROR_MAX_STATUS
  )
    return false;
  if (CLIENT_ERROR_NOISE_STATUSES.has(statusCode)) return false;
  return !(statusCode === UNMATCHED_ROUTE_STATUS && !handlerName);
}

/** A mensagem sem as partes que mudam a cada ocorrência (ids, números). */
export function messageShape(message: string): string {
  return MESSAGE_SHAPE_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    message,
  );
}

/** Assinatura que torna dois registros "o mesmo problema". */
export function repeatKey(record: ObservabilityRecord): string {
  return [
    record.level,
    record.context,
    record.errorCode,
    record.errorFingerprint,
    record.routeTemplate,
    record.jobName,
    messageShape(record.message),
  ].join('|');
}

/**
 * Janela de repetição em memória, por processo.
 *
 * Não guarda nada além do primeiro registro de cada assinatura e um contador;
 * com o limite de chaves atingido, deixa passar em vez de crescer.
 */
export class TechnicalLogRepeatWindow {
  private readonly entries = new Map<
    string,
    { first: ObservabilityRecord; endsAt: number; repeats: number; last: Date }
  >();

  constructor(private readonly windowMs: number) {}

  /** `true` quando o registro deve ser gravado; `false` quando foi contado. */
  admit(record: ObservabilityRecord, now: Date): boolean {
    if (this.windowMs <= 0) return true;
    const key = repeatKey(record);
    const entry = this.entries.get(key);
    if (entry && now.getTime() < entry.endsAt) {
      entry.repeats += 1;
      entry.last = now;
      return false;
    }
    if (!entry && this.entries.size >= REPEAT_WINDOW_MAX_KEYS) return true;
    this.entries.set(key, {
      first: record,
      endsAt: now.getTime() + this.windowMs,
      repeats: 0,
      last: now,
    });
    return true;
  }

  /** Remove as janelas encerradas (ou todas) e devolve as que repetiram. */
  collect(now: Date, all = false): ClosedRepeatWindow[] {
    const closed: ClosedRepeatWindow[] = [];
    for (const [key, entry] of this.entries) {
      if (!all && now.getTime() < entry.endsAt) continue;
      this.entries.delete(key);
      if (entry.repeats > 0)
        closed.push({
          first: entry.first,
          repeats: entry.repeats,
          lastOccurredAt: entry.last,
        });
    }
    return closed;
  }
}
