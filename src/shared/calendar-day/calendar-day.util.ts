/**
 * Que dia é hoje, para o Clubinho.
 *
 * Existe porque a resposta depende do fuso, e o fuso do processo não serve: a
 * API roda em contêiner, e contêiner roda em UTC. Entre 21h e a meia-noite no
 * Brasil, `new Date()` num processo em UTC já está no dia seguinte — o encontro
 * de sábado sairia da agenda às 21h de sábado, e uma série encerrada perderia
 * um dia a mais do que devia.
 *
 * É o mesmo motivo pelo qual o agendador fixa o fuso nas expressões de cron.
 */

/**
 * Fuso em que toda data de calendário do Clubinho é lida.
 *
 * O horário de verão brasileiro está extinto, mas o fuso nomeado continua sendo
 * a forma certa de dizer isto: a regra volta a valer sozinha se a lei voltar.
 */
export const APP_TIMEZONE = 'America/Sao_Paulo';

/**
 * `en-CA` porque é o único locale comum que formata data como `YYYY-MM-DD`.
 * Montar a string a partir das partes daria o mesmo resultado com mais código.
 */
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** O dia de calendário de um instante, em `YYYY-MM-DD`. */
export function calendarDayOf(instant: Date): string {
  return dayFormatter.format(instant);
}

/** Hoje, em `YYYY-MM-DD`. */
export function todayInAppTimezone(): string {
  return calendarDayOf(new Date());
}

/** A hora do dia agora, em `HH:mm`, no mesmo fuso. */
export function timeNowInAppTimezone(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}
