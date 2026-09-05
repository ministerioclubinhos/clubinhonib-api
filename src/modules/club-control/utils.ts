import {
  CLUB_WEEK_PENDING_STATUSES,
  CLUB_WEEK_STATUS_LABELS,
} from './constants';

/**
 * Se o status de uma semana pede cobrança.
 *
 * O status chega como `string` do `ClubStatusService`, que ainda não usa o
 * enum; a comparação acontece aqui, num lugar só, em vez de virar dois
 * literais soltos em cada aviso.
 */
export function isPendingStatus(status: string): boolean {
  return (CLUB_WEEK_PENDING_STATUSES as readonly string[]).includes(status);
}

/**
 * O status em texto legível para o corpo do e-mail.
 *
 * Um status desconhecido devolve o próprio valor: o resumo sai com a palavra
 * crua em vez de não sair.
 */
export function clubWeekStatusLabel(status: string): string {
  return (CLUB_WEEK_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

/**
 * A data em `YYYY-MM-DD` no fuso local.
 *
 * `toISOString()` converte para UTC e, em `America/Sao_Paulo`, adianta o dia
 * depois das 21h — o que jogaria a referência de um aviso de domingo cedo para
 * a semana errada. É a mesma armadilha que `formatDateOnly` evita no cálculo da
 * semana letiva.
 */
export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
