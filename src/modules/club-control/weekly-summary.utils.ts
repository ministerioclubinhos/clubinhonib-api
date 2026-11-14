import {
  ClubWeeklySummaryCellDto,
  ClubWeeklySummaryCountsDto,
  ClubWeeklySummaryHighlightsDto,
  ClubWeeklySummaryStatusCountsDto,
  ClubWeeklySummaryWeekDto,
} from './dto/club-weekly-summary.dto';
import { SummaryChildRaw } from './dto/club-control-raw.dto';
import {
  ClubWeekStatus,
  ClubWeekTimeline,
  CLUB_WEEK_STATUS_VALUES,
} from './constants';
import { ClubWeekException } from './types';
import { isPendingStatus } from './utils';

/**
 * Regras puras do resumo semanal.
 *
 * Ficam aqui, e não dentro do caso de uso, porque são o que decide o desenho
 * do quadro — quantas crianças contam numa data, quando um feriado apaga o
 * encontro, como a média do período é lida. Sem banco e sem Nest, cada uma
 * dessas decisões pode ser conferida por um teste.
 */

/**
 * O status devolvido pelo `ClubStatusService`, estreitado para o enum.
 *
 * Aquele serviço ainda tipa o retorno como `string`; padronizá-lo é uma
 * limpeza à parte. Um valor fora do enum vira `pending`: é o único status
 * neutro — não acusa um clubinho de falta nem afirma que a semana fechou em
 * dia, e é o que se deve mostrar quando a régua cresceu e esta tela ainda não
 * aprendeu o valor novo.
 */
export function toClubWeekStatus(status: string): ClubWeekStatus {
  return (CLUB_WEEK_STATUS_VALUES as readonly string[]).includes(status)
    ? (status as ClubWeekStatus)
    : ClubWeekStatus.Pending;
}

/**
 * Onde a semana está em relação a hoje.
 *
 * Sem semana corrente — hoje fora do período letivo — nenhuma semana é futura:
 * é a mesma leitura de `AcademicWeekService.getWeekType`, que devolve
 * `isPast` nesse caso.
 */
export function weekTimelineOf(
  week: number,
  currentWeek: number | null,
): ClubWeekTimeline {
  if (currentWeek === null) return ClubWeekTimeline.Past;
  if (week === currentWeek) return ClubWeekTimeline.Current;
  return week > currentWeek ? ClubWeekTimeline.Future : ClubWeekTimeline.Past;
}

/**
 * Se a criança conta nos números de uma data.
 *
 * A mesma régua de `ClubWeekCheckService`: quem saiu do clubinho não conta, e
 * quem entrou depois daquele dia também não — cobrar a pagela de uma semana
 * anterior à matrícula inventaria uma falta que nunca existiu. Sem data
 * esperada não há com o que comparar, e a entrada deixa de filtrar.
 */
export function isChildCountedOn(
  child: SummaryChildRaw,
  expectedDate: string | null,
): boolean {
  if (!child.isActive) return false;
  if (!child.joinedAt || !expectedDate) return true;
  return child.joinedAt <= expectedDate;
}

/**
 * A exceção que vale para a data, se houver.
 *
 * Primeiro a data exata; só depois uma recorrente com o mesmo dia e mês, a
 * mais recente delas. É a mesma ordem de `findExceptionByDate` — feita aqui
 * sobre a lista já carregada, porque o quadro cobre dezenas de datas e uma
 * consulta por célula seria uma ida ao banco por dia do período.
 */
export function findExceptionForDate(
  exceptions: readonly ClubWeekException[],
  date: string | null,
): ClubWeekException | null {
  if (!date) return null;

  const exact = exceptions.find(
    (exception) => exception.exceptionDate === date,
  );
  if (exact) return exact;

  const monthDay = date.slice(5);
  const recurrent = exceptions
    .filter(
      (exception) =>
        exception.isRecurrent && exception.exceptionDate.slice(5) === monthDay,
    )
    .sort((a, b) => b.exceptionDate.localeCompare(a.exceptionDate));

  return recurrent[0] ?? null;
}

/**
 * Percentual de crianças com pagela, com uma casa decimal.
 *
 * Sem criança considerada o resultado é `0`, e não `NaN`: a tela mostra 0%,
 * que é o que uma semana sem ninguém a atender significa.
 */
export function completionRateOf(withPagela: number, children: number): number {
  if (children <= 0) return 0;
  return Math.round((withPagela / children) * 1000) / 10;
}

/** Os números de um clubinho numa semana. */
export function countsOf(
  children: number,
  childrenWithPagela: number,
  childrenPresent: number,
): ClubWeeklySummaryCountsDto {
  return {
    children,
    childrenWithPagela,
    childrenMissing: children - childrenWithPagela,
    childrenPresent,
    completionRate: completionRateOf(childrenWithPagela, children),
  };
}

/** Números zerados, para uma semana sem clubinho a contar. */
export function emptyCounts(): ClubWeeklySummaryCountsDto {
  return countsOf(0, 0, 0);
}

/** A soma de vários recortes, com o percentual recalculado sobre o total. */
export function sumCounts(
  parts: readonly ClubWeeklySummaryCountsDto[],
): ClubWeeklySummaryCountsDto {
  return parts.reduce(
    (total, part) =>
      countsOf(
        total.children + part.children,
        total.childrenWithPagela + part.childrenWithPagela,
        total.childrenPresent + part.childrenPresent,
      ),
    emptyCounts(),
  );
}

/** Quantos clubinhos ficaram em cada situação. */
export function countStatuses(
  cells: readonly ClubWeeklySummaryCellDto[],
): ClubWeeklySummaryStatusCountsDto {
  const counts: ClubWeeklySummaryStatusCountsDto = {
    ok: 0,
    partial: 0,
    missing: 0,
    pending: 0,
    exception: 0,
    inactive: 0,
    outOfPeriod: 0,
  };

  for (const cell of cells) {
    switch (cell.status) {
      case ClubWeekStatus.Ok:
        counts.ok += 1;
        break;
      case ClubWeekStatus.Partial:
        counts.partial += 1;
        break;
      case ClubWeekStatus.Missing:
        counts.missing += 1;
        break;
      case ClubWeekStatus.Pending:
        counts.pending += 1;
        break;
      case ClubWeekStatus.Exception:
        counts.exception += 1;
        break;
      case ClubWeekStatus.Inactive:
        counts.inactive += 1;
        break;
      case ClubWeekStatus.OutOfPeriod:
        counts.outOfPeriod += 1;
        break;
    }
  }

  return counts;
}

/**
 * A leitura do período a partir das semanas já decorridas.
 *
 * As semanas futuras ficam de fora de propósito: elas nascem sem pagela
 * nenhuma, e somá-las faria a média do ano despencar toda vez que o período
 * fosse cadastrado com meses pela frente.
 *
 * Melhor e pior semana só consideram semanas que tiveram criança a atender —
 * uma semana de recesso, com zero criança considerada, sairia sempre como a
 * pior com 0%, escondendo a semana que de fato correu mal.
 */
export function highlightsOf(
  weeks: readonly ClubWeeklySummaryWeekDto[],
): ClubWeeklySummaryHighlightsDto {
  const elapsed = weeks.filter(
    (week) => week.timeline !== ClubWeekTimeline.Future,
  );
  const rated = elapsed.filter((week) => week.counts.children > 0);

  const best = rated.reduce<ClubWeeklySummaryWeekDto | null>(
    (chosen, week) =>
      !chosen || week.counts.completionRate > chosen.counts.completionRate
        ? week
        : chosen,
    null,
  );
  const worst = rated.reduce<ClubWeeklySummaryWeekDto | null>(
    (chosen, week) =>
      !chosen || week.counts.completionRate < chosen.counts.completionRate
        ? week
        : chosen,
    null,
  );

  return {
    weeksElapsed: elapsed.length,
    counts: sumCounts(elapsed.map((week) => week.counts)),
    bestWeek: best?.week ?? null,
    worstWeek: worst?.week ?? null,
    weeksWithPendency: elapsed.filter((week) =>
      week.clubs.some((club) => isPendingStatus(club.status)),
    ).length,
  };
}
