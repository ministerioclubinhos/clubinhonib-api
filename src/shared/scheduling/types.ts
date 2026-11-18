/**
 * Nome de cada job agendado.
 *
 * É o que aparece no log e o que a trava de concorrência usa como chave, então
 * não pode ser string solta no meio do código.
 */
export enum ScheduledJobName {
  SchedulerHeartbeat = 'scheduler-heartbeat',
  MissingPagelaReminder = 'missing-pagela-reminder',
  CoordinatorWeeklySummary = 'coordinator-weekly-summary',
}

/** Por que um job não chegou a rodar. */
export enum JobSkipReason {
  /** `SCHEDULER_ENABLED` desligado nesta instância. */
  SchedulerDisabled = 'scheduler-disabled',
  /** A execução anterior do mesmo job ainda não terminou. */
  AlreadyRunning = 'already-running',
}

/** Como uma execução terminou. */
export enum JobRunStatus {
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
}

/**
 * O que uma execução conta sobre si mesma.
 *
 * O runner nunca deixa o erro escapar — um job que quebra não pode derrubar o
 * processo da API —, então este resultado é o único registro do que houve.
 */
export interface JobRunResult {
  job: ScheduledJobName;
  status: JobRunStatus;
  /** Quanto durou, em milissegundos; zero quando nem chegou a rodar. */
  durationMs: number;
  /** Presente apenas quando `status` é `Skipped`. */
  skipReason?: JobSkipReason;
  /** Mensagem do erro quando `status` é `Failed`. */
  error?: string;
}

/** O trabalho em si, sem nada de agendamento dentro. */
export type JobTask = () => Promise<void>;
