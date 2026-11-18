import { APP_TIMEZONE } from 'src/shared/calendar-day';

/**
 * Fuso em que toda expressão de agendamento é lida.
 *
 * Fixo, e nunca o fuso do servidor: um contêiner em UTC dispararia o aviso das
 * 8h para uma professora às 5h da manhã.
 *
 * É o mesmo fuso em que o calendário lê as datas — uma definição só, em
 * `shared/calendar-day`, para que o agendador e a agenda nunca discordem sobre
 * que dia é hoje.
 */
export const SCHEDULING_TIMEZONE = APP_TIMEZONE;

/**
 * Liga o agendador nesta instância.
 *
 * Existe porque o agendador é `@Cron` em processo: **cada** instância da API
 * que sobe passa a disparar os mesmos horários por conta própria. Com duas
 * réplicas, todo aviso sai duas vezes.
 *
 * Enquanto não houver trava distribuída, a regra é ligar isto em uma instância
 * só. Ausente, os jobs ficam registrados e não executam — que é o que se quer
 * em máquina de desenvolvimento e na suíte de testes.
 */
export const SCHEDULING_ENABLED_ENV = 'SCHEDULER_ENABLED';

/**
 * Horário de cada job, em um lugar só.
 *
 * Ficam aqui, e não espalhados nos decoradores, porque a pergunta "o que roda
 * de madrugada?" tem que ser respondida sem abrir job por job.
 *
 * Formato de cinco campos: `minuto hora dia-do-mês mês dia-da-semana`.
 */
export const JOB_SCHEDULES = {
  /** Todo dia às 7h, uma prova de vida do agendador. */
  schedulerHeartbeat: '0 7 * * *',

  /**
   * Domingo às 8h: as pagelas que faltaram na semana que fechou.
   *
   * Domingo nunca é dia de clubinho, então de manhã a semana anterior está
   * fechada. Às 8h, e não à meia-noite: aviso de madrugada é lido junto com o
   * spam da noite.
   */
  missingPagelaReminder: '0 8 * * 0',

  /**
   * Segunda às 8h: o resumo da semana para cada coordenador.
   *
   * Um dia depois do lembrete dos professores, de propósito — no domingo ainda
   * dá para lançar a pagela que faltou, e o resumo conta o que sobrou.
   */
  coordinatorWeeklySummary: '0 8 * * 1',
} as const;

/** Quanto tempo um job pode levar antes de o log virar aviso. */
export const JOB_SLOW_RUN_MS = 30_000;
