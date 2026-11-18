import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditActionType, AuditOutcome } from 'src/core/audit/enums';
import { ActionBoundaryService } from 'src/core/audit/services/action-boundary.service';

import { JOB_SLOW_RUN_MS } from './constants';
import {
  JobRunResult,
  JobRunStatus,
  JobSkipReason,
  JobTask,
  ScheduledJobName,
} from './types';
import { errorMessage, formatDuration, isSchedulerEnabled } from './utils';

/**
 * A engrenagem que roda todo job agendado.
 *
 * Um job declara **quando** roda e **o que** faz; tudo o que se repete entre
 * eles — a chave que liga o agendador, o log com duração, o erro que não pode
 * escapar, a execução que ainda não terminou — mora aqui. Job que faz isso por
 * conta própria vira treze variações do mesmo `try/catch`.
 *
 * Três garantias:
 *
 * - **desligado por padrão**: sem `SCHEDULER_ENABLED`, nada executa. O
 *   agendador é em processo, então cada réplica da API dispararia os mesmos
 *   horários e todo aviso sairia repetido;
 * - **nunca derruba o processo**: um job que lança é registrado como falho e a
 *   API segue de pé. Ninguém está esperando essa resposta;
 * - **não se sobrepõe**: enquanto uma execução de um job não termina, a
 *   próxima do mesmo job é dispensada. Um job lento acumularia execuções
 *   paralelas disputando o mesmo banco.
 */
@Injectable()
export class JobRunnerService {
  private readonly logger = new Logger(JobRunnerService.name);

  /**
   * Quais jobs estão em execução agora.
   *
   * Vale só dentro deste processo, que é exatamente o alcance da trava que se
   * quer aqui: com `SCHEDULER_ENABLED` em uma instância só, esse processo é o
   * único que dispara. Trava entre instâncias é outro problema, e resolvê-la
   * com um `Set` em memória seria fingir que está resolvido.
   */
  private readonly running = new Set<ScheduledJobName>();

  constructor(
    private readonly configService: ConfigService,
    /**
     * Fronteira de auditoria dos jobs. Opcional para o runner continuar
     * construível sozinho nos testes; com ela, cada execução vira uma ação
     * auditada e todo erro logado no caminho carrega o nome do job.
     */
    @Optional() private readonly boundary?: ActionBoundaryService,
  ) {}

  /** Se o agendador está ligado nesta instância. */
  get enabled(): boolean {
    return isSchedulerEnabled((key) => this.configService.get<string>(key));
  }

  /**
   * Roda o trabalho de um job com log, trava e captura de erro.
   *
   * Não lança nunca: quem chama é o decorador `@Cron`, e não há a quem
   * devolver o erro.
   */
  async run(job: ScheduledJobName, task: JobTask): Promise<JobRunResult> {
    if (!this.enabled) {
      return this.skipped(job, JobSkipReason.SchedulerDisabled);
    }

    if (this.running.has(job)) {
      this.logger.warn(
        `Job "${job}" ainda executando desde o disparo anterior: execução dispensada.`,
      );
      return this.skipped(job, JobSkipReason.AlreadyRunning);
    }

    const execute = () => this.execute(job, task);
    if (!this.boundary) return execute();

    return this.boundary.run(
      {
        actionType: AuditActionType.ScheduledJob,
        actionName: job,
        jobName: job,
      },
      execute,
      (result) =>
        result.status === JobRunStatus.Completed
          ? AuditOutcome.Succeeded
          : AuditOutcome.Failed,
    );
  }

  private async execute(
    job: ScheduledJobName,
    task: JobTask,
  ): Promise<JobRunResult> {
    this.running.add(job);
    const startedAt = Date.now();
    this.logger.log(`Job "${job}" iniciado.`);

    try {
      await task();
      const durationMs = Date.now() - startedAt;
      this.finishLog(job, durationMs);

      return { job, status: JobRunStatus.Completed, durationMs };
    } catch (error: unknown) {
      const durationMs = Date.now() - startedAt;
      this.logger.error(
        `Job "${job}" falhou após ${formatDuration(durationMs)}.`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        job,
        status: JobRunStatus.Failed,
        durationMs,
        error: errorMessage(error),
      };
    } finally {
      this.running.delete(job);
    }
  }

  /** Um job lento é aviso, não informação: ele encosta no disparo seguinte. */
  private finishLog(job: ScheduledJobName, durationMs: number): void {
    const message = `Job "${job}" concluído em ${formatDuration(durationMs)}.`;

    if (durationMs >= JOB_SLOW_RUN_MS) {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }

  private skipped(
    job: ScheduledJobName,
    skipReason: JobSkipReason,
  ): JobRunResult {
    return { job, status: JobRunStatus.Skipped, durationMs: 0, skipReason };
  }
}
