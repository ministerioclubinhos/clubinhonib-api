/**
 * Quem era esperado no clubinho, e quando.
 *
 * A taxa de presença dividia os presentes pelas **pagelas lançadas**: um
 * clubinho que só lançava pagela de quem veio aparecia com 100%, e uma semana
 * sem lançamento nenhum simplesmente sumia da conta. O denominador certo é
 * quem **devia** estar lá — e é isso que este arquivo calcula.
 *
 * Uma criança é esperada num dia de clubinho quando, naquele dia:
 *
 * - já tinha entrado (`joinedAt` vazio ou anterior/igual ao dia); e
 * - ainda não tinha sido desativada (segue ativa, ou foi desativada no próprio
 *   dia ou depois).
 *
 * E o dia só conta quando existe para o calendário letivo: dentro do período,
 * não é feriado/recesso e não está no futuro.
 *
 * Tudo aqui é puro e compara datas como texto `YYYY-MM-DD` — a ordem
 * alfabética desse formato é a ordem do calendário, e assim nenhuma conta
 * passa por fuso.
 */

import {
  AcademicPeriod,
  formatDateOnly,
  getAcademicWeek,
  parseDateOnly,
} from 'src/shared/academic-week/academic-week.util';

import { WEEKDAY_OFFSET_FROM_MONDAY } from '../constants';
import {
  EnrollmentRecord,
  ExceptionDay,
  ExpectedChild,
  ExpectedSummary,
  ExpectedWeek,
  ExpectedWindow,
} from '../types';

/** Soma dias a uma data `YYYY-MM-DD`, sem passar por fuso. */
export function addDaysToDateOnly(date: string, days: number): string {
  const parsed = parseDateOnly(date);
  parsed.setDate(parsed.getDate() + days);
  return formatDateOnly(parsed);
}

/** Segunda-feira da semana em que a data cai. */
export function mondayOf(date: string): string {
  const weekday = parseDateOnly(date).getDay();
  return addDaysToDateOnly(date, weekday === 0 ? -6 : 1 - weekday);
}

/**
 * A criança estava matriculada nesta data?
 *
 * É a regra que substitui o `isActive` atual nas contas históricas: quem saiu
 * em novembro continua contando de março a outubro. Criança inativa sem dia de
 * desativação conhecido não conta — não há como afirmar até quando frequentou.
 */
export function wasEnrolledAt(child: EnrollmentRecord, date: string): boolean {
  if (child.joinedAt && child.joinedAt > date) return false;
  if (child.isActive) return true;

  return child.deactivationDay !== null && child.deactivationDay >= date;
}

/** Quantas das crianças estavam matriculadas na data. */
export function countEnrolledAt(
  children: readonly EnrollmentRecord[],
  date: string,
): number {
  return children.filter((child) => wasEnrolledAt(child, date)).length;
}

/**
 * Todas as semanas letivas de um período, da 1 à última.
 *
 * A semana 1 é a que contém o início do período, mesmo que ele comece no meio
 * dela — a mesma conta de `getAcademicWeek`.
 */
export function listAcademicWeeks(period: AcademicPeriod): ExpectedWeek[] {
  const lastWeek = getAcademicWeek(period.endDate, period)?.week ?? 0;
  const firstMonday = mondayOf(period.startDate);

  return Array.from({ length: lastWeek }, (_, index) => ({
    year: period.year,
    week: index + 1,
    weekStart: addDaysToDateOnly(firstMonday, index * 7),
    periodStart: period.startDate,
    periodEnd: period.endDate,
  }));
}

/**
 * O dia em que o clubinho se reúne numa semana.
 *
 * Dia da semana desconhecido devolve `null`: sem saber quando o clubinho se
 * reúne não há dia em que alguém fosse esperado.
 */
export function clubDayInWeek(
  weekStart: string,
  weekday: string,
): string | null {
  const offset = WEEKDAY_OFFSET_FROM_MONDAY[weekday?.toLowerCase()];

  return offset === undefined ? null : addDaysToDateOnly(weekStart, offset);
}

/** O dia cai numa exceção de calendário (feriado, recesso)? */
export function isExceptionDay(
  date: string,
  exceptions: readonly ExceptionDay[],
): boolean {
  return exceptions.some(
    (exception) =>
      exception.date === date ||
      (exception.isRecurrent && exception.date.slice(5) === date.slice(5)),
  );
}

/**
 * Havia clubinho neste dia, para efeito de cobrança?
 *
 * Só conta o dia que está dentro do período letivo, dentro do recorte pedido,
 * que não é exceção e que já chegou. Semana fora do período ou no futuro não é
 * "pagela faltando": ali não existe pagela a lançar.
 */
export function isClubDayExpected(
  date: string,
  week: Pick<ExpectedWeek, 'periodStart' | 'periodEnd'>,
  window: ExpectedWindow,
): boolean {
  if (date < week.periodStart || date > week.periodEnd) return false;
  if (date > window.today) return false;
  if (window.startDate && date < window.startDate) return false;
  if (window.endDate && date > window.endDate) return false;

  return !isExceptionDay(date, window.exceptions);
}

/**
 * Presenças esperadas, agrupadas pela chave que o chamador escolher.
 *
 * Cada criança matriculada num dia de clubinho que contou vale uma presença
 * esperada. `keyOf` diz em que grupo ela entra (clubinho, semana, gênero…);
 * devolver `null` deixa a presença fora da conta.
 */
export function summarizeExpected<T extends ExpectedChild>(
  children: readonly T[],
  weeks: readonly ExpectedWeek[],
  window: ExpectedWindow,
  keyOf: (child: T, week: ExpectedWeek) => string | null,
): Map<string, ExpectedSummary> {
  const slots = new Map<string, number>();
  const childrenByKey = new Map<string, Set<string>>();
  // O dia do clubinho depende só da semana e do dia da semana: calcular uma
  // vez por par evita refazer a conta de data para cada criança.
  const clubDays = new Map<string, string | null>();

  for (const week of weeks) {
    for (const child of children) {
      const cacheKey = `${week.year}-${week.week}-${child.clubWeekday}`;
      let day = clubDays.get(cacheKey);
      if (day === undefined) {
        const candidate = clubDayInWeek(week.weekStart, child.clubWeekday);
        day =
          candidate && isClubDayExpected(candidate, week, window)
            ? candidate
            : null;
        clubDays.set(cacheKey, day);
      }

      if (!day || !wasEnrolledAt(child, day)) continue;

      const key = keyOf(child, week);
      if (key === null) continue;

      slots.set(key, (slots.get(key) ?? 0) + 1);
      const seen = childrenByKey.get(key) ?? new Set<string>();
      seen.add(child.id);
      childrenByKey.set(key, seen);
    }
  }

  const summary = new Map<string, ExpectedSummary>();
  slots.forEach((count, key) => {
    summary.set(key, {
      slots: count,
      children: childrenByKey.get(key)?.size ?? 0,
    });
  });

  return summary;
}
