/**
 * Regra de fuso das estatísticas.
 *
 * As colunas de data do banco (`pagela.date`, `child.birthDate`, ...) guardam
 * uma data de calendário, sem horário. As janelas de filtro são construídas com
 * `new Date(ano, mês, dia)`, que produz meia-noite **local** ao processo.
 *
 * Formatar essa data com `toISOString()` a converte para UTC antes de recortar
 * o `YYYY-MM-DD`: em um processo rodando em fuso positivo (UTC+X), meia-noite
 * local é o **dia anterior** em UTC, e a janela inteira desliza um dia. Como o
 * projeto não fixa `TZ` em lugar nenhum, o resultado passava a depender de onde
 * a API estivesse rodando.
 *
 * Por isso a formatação usa os componentes locais da data, nunca UTC.
 */

/** Formata uma data como `YYYY-MM-DD`, preservando o dia local. */
export function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Data de hoje, sem horário, no fuso local. */
export function todayAsLocalDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Interpreta `YYYY-MM-DD` como data local, sem deslocar o dia. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Soma dias a uma data, devolvendo uma nova data local. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
