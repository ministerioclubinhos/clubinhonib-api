import { getAcademicWeek } from 'src/shared/academic-week/academic-week.util';

import { PAGELA_LAUNCH_CLOSED_MESSAGES } from './constants';
import { PagelaLaunchClosedReason } from './enums/pagela-launch-closed-reason.enum';
import { AcademicPeriod, PagelaLaunchWindow } from './types';

/**
 * Regras puras da janela de lançamento de pagelas.
 *
 * Pagela só se lança dentro do período letivo. As datas são `YYYY-MM-DD`, e
 * nesse formato a ordem do texto é a ordem do calendário — por isso as
 * comparações são de string, sem passar por fuso.
 */

/** O período cobre o dia? */
export function periodCovers(period: AcademicPeriod, day: string): boolean {
  return day >= period.startDate && day <= period.endDate;
}

function closedWindow(
  today: string,
  reason: PagelaLaunchClosedReason,
  period: AcademicPeriod | null,
): PagelaLaunchWindow {
  return {
    open: false,
    reason,
    today,
    year: period?.year ?? null,
    currentWeek: null,
    totalWeeks: null,
    startDate: period?.startDate ?? null,
    endDate: period?.endDate ?? null,
  };
}

/**
 * A janela de lançamento em um dia, dados os períodos letivos ativos.
 *
 * Fora de qualquer período, a resposta diz o motivo e traz o período mais
 * útil para a mensagem: o próximo, se houver um por vir; senão, o último que
 * terminou.
 */
export function launchWindowOf(
  today: string,
  periods: readonly AcademicPeriod[],
): PagelaLaunchWindow {
  const current = periods.find((period) => periodCovers(period, today));

  if (current) {
    return {
      open: true,
      reason: null,
      today,
      year: current.year,
      currentWeek: getAcademicWeek(today, current)?.week ?? 1,
      totalWeeks: getAcademicWeek(current.endDate, current)?.week ?? 1,
      startDate: current.startDate,
      endDate: current.endDate,
    };
  }

  const upcoming = periods
    .filter((period) => period.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming) {
    return closedWindow(today, PagelaLaunchClosedReason.NOT_STARTED, upcoming);
  }

  const last = periods
    .filter((period) => period.endDate < today)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  if (last) {
    return closedWindow(today, PagelaLaunchClosedReason.ENDED, last);
  }

  return closedWindow(today, PagelaLaunchClosedReason.NO_PERIOD, null);
}

/** `2026-03-07` vira `07/03/2026`, para a mensagem que o usuário lê. */
function brazilianDay(day: string | null): string {
  if (!day) return '';
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

/** Explica, em português, por que a janela está fechada. */
export function launchClosedMessage(window: PagelaLaunchWindow): string {
  const reason = window.reason ?? PagelaLaunchClosedReason.NO_PERIOD;
  const template = PAGELA_LAUNCH_CLOSED_MESSAGES[reason];

  return template
    .replace('{start}', brazilianDay(window.startDate))
    .replace('{end}', brazilianDay(window.endDate));
}
