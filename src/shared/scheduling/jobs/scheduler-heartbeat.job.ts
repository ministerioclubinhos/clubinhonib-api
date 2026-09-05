import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { JOB_SCHEDULES, SCHEDULING_TIMEZONE } from '../constants';
import { JobRunnerService } from '../job-runner.service';
import { ScheduledJobName } from '../types';

/**
 * Prova de vida do agendador — e o molde de todo job que vier depois.
 *
 * Não manda e-mail nem toca no banco: só registra que o agendador acordou no
 * horário. Sem ele, um agendador que parou de rodar em produção é
 * indistinguível de uma semana em que nada precisou ser avisado, e a falha só
 * aparece quando alguém reclama do aviso que não chegou.
 *
 * O formato se repete nos próximos: o decorador diz **quando**, o método diz
 * **o que**, e o `JobRunnerService` cuida do resto. O trabalho em si vai em um
 * serviço de caso de uso — este arquivo não implementa regra de negócio nem
 * monta conteúdo de e-mail.
 */
@Injectable()
export class SchedulerHeartbeatJob {
  private readonly logger = new Logger(SchedulerHeartbeatJob.name);

  constructor(private readonly jobRunner: JobRunnerService) {}

  @Cron(JOB_SCHEDULES.schedulerHeartbeat, {
    name: ScheduledJobName.SchedulerHeartbeat,
    timeZone: SCHEDULING_TIMEZONE,
  })
  async handleCron(): Promise<void> {
    await this.jobRunner.run(ScheduledJobName.SchedulerHeartbeat, () => {
      this.logger.log(`Agendador ativo em ${SCHEDULING_TIMEZONE}.`);
      return Promise.resolve();
    });
  }
}
