import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import { todayInAppTimezone } from 'src/shared/calendar-day';

/**
 * Quando cada evento acontece.
 *
 * As datas de um encontro de clubinho não são gravadas: elas nascem do cruzamento
 * entre o dia da semana do clubinho, o período letivo e as exceções. Guardá-las
 * significaria regravar dezenas de linhas por clubinho a cada vez que o período
 * mudasse de data ou uma exceção fosse cadastrada — e conviver com o risco de
 * duplicar. Aqui elas são calculadas na leitura, então cadastrar um período ou
 * uma exceção já muda o calendário sem escrever nada.
 *
 * O módulo é de funções puras de propósito: a regra é a parte que precisa de
 * teste, e ela não depende de banco.
 */

/** Posição de cada dia da semana em `Date.getDay()`. */
const WEEKDAY_INDEX: Record<Weekday, number> = {
  [Weekday.MONDAY]: 1,
  [Weekday.TUESDAY]: 2,
  [Weekday.WEDNESDAY]: 3,
  [Weekday.THURSDAY]: 4,
  [Weekday.FRIDAY]: 5,
  [Weekday.SATURDAY]: 6,
};

/** Período letivo, reduzido ao que a expansão precisa. */
export interface PeriodWindow {
  startDate: string;
  endDate: string;
}

/** Exceção de calendário, reduzida ao que a expansão precisa. */
export interface ExceptionWindow {
  exceptionDate: string;
  isRecurrent: boolean;
}

/** Recorrência de um evento, reduzida ao que a expansão precisa. */
export interface RecurrenceSource {
  date: string;
  isRecurring: boolean;
  weekday?: Weekday | null;
}

/** Recorte opcional de datas pedido por quem consulta. */
export interface DateRange {
  from?: string | null;
  to?: string | null;
}

/**
 * Data em `YYYY-MM-DD`.
 *
 * A coluna é texto e o driver pode devolver `Date` para colunas `date`; as duas
 * formas passam por aqui. Datas normalizadas assim se comparam com `<` e `>` de
 * string, o que evita construir `Date` só para ordenar — e evita o fuso junto.
 */
export function toDateKey(value: string | Date): string {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  return String(value).split('T')[0];
}

/**
 * Hoje em `YYYY-MM-DD`.
 *
 * No fuso do Clubinho, nunca no do processo: a API roda em contêiner, e às 21h
 * de sábado no Brasil um processo em UTC já está no domingo — o encontro de
 * sábado sairia da agenda três horas antes da hora.
 */
export function todayKey(): string {
  return todayInAppTimezone();
}

/** Primeira data em `weekday` que cai em `start` ou depois dele. */
function firstWeekdayFrom(start: string, weekday: Weekday): string {
  const [year, month, day] = start.split('-').map(Number);
  const cursor = new Date(year, month - 1, day);
  const distance = (WEEKDAY_INDEX[weekday] - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + distance);
  return toDateKey(cursor);
}

/** A mesma data, sete dias à frente. */
function nextWeek(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const cursor = new Date(year, month - 1, day + 7);
  return toDateKey(cursor);
}

const latest = (values: (string | null | undefined)[]): string =>
  values
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) as string;

const earliest = (values: (string | null | undefined)[]): string | null => {
  const defined = values.filter((value): value is string => !!value).sort();
  return defined[0] ?? null;
};

/**
 * Consulta de exceções por data, pronta para ser usada dentro do laço.
 *
 * Uma exceção recorrente vale para o mesmo dia e mês em qualquer ano — é o
 * padrão do cadastro (`isRecurrent` nasce `true`), porque a maioria é feriado.
 */
export class ExceptionCalendar {
  private readonly exactDates = new Set<string>();
  private readonly yearlyDays = new Set<string>();

  constructor(exceptions: ExceptionWindow[]) {
    for (const exception of exceptions) {
      const date = toDateKey(exception.exceptionDate);
      this.exactDates.add(date);
      if (exception.isRecurrent) this.yearlyDays.add(date.slice(5));
    }
  }

  /** True quando não há Clubinho nesse dia. */
  blocks(date: string): boolean {
    return this.exactDates.has(date) || this.yearlyDays.has(date.slice(5));
  }
}

/**
 * Datas em que o evento acontece, já sem os dias de exceção.
 *
 * Um evento comum tem uma data só e não responde ao período letivo: ele foi
 * marcado à mão para um dia específico. Um encontro de clubinho só existe
 * dentro de um período letivo ativo — sem período cadastrado para o ano, a
 * interseção é vazia e o encontro não aparece em lugar nenhum.
 */
export function expandOccurrences(
  event: RecurrenceSource,
  periods: PeriodWindow[],
  exceptions: ExceptionCalendar,
  range: DateRange = {},
): string[] {
  const seriesStart = toDateKey(event.date);

  if (!event.isRecurring || !event.weekday) {
    const withinRange =
      (!range.from || seriesStart >= toDateKey(range.from)) &&
      (!range.to || seriesStart <= toDateKey(range.to));

    return withinRange ? [seriesStart] : [];
  }

  const dates: string[] = [];

  for (const period of periods) {
    // O dia de clubinho só vale onde tudo se sobrepõe: dentro do período
    // letivo, a partir de quando a recorrência começou e dentro do recorte
    // pedido por quem consulta.
    const start = latest([
      toDateKey(period.startDate),
      seriesStart,
      range.from ? toDateKey(range.from) : null,
    ]);
    const end = earliest([
      toDateKey(period.endDate),
      range.to ? toDateKey(range.to) : null,
    ]);

    if (!end || start > end) continue;

    let cursor = firstWeekdayFrom(start, event.weekday);
    while (cursor <= end) {
      if (!exceptions.blocks(cursor)) dates.push(cursor);
      cursor = nextWeek(cursor);
    }
  }

  // Períodos são um por ano, mas nada garante a ordem em que chegaram.
  return [...new Set(dates)].sort();
}
