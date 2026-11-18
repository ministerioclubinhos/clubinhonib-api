import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import {
  JobRunnerService,
  JOB_SCHEDULES,
  SCHEDULING_TIMEZONE,
  ScheduledJobName,
} from 'src/shared/scheduling';

import { NotifyCoordinatorSummaryService } from '../services/notify-coordinator-summary.service';

/**
 * Segunda-feira de manhã: o resumo da semana passada para cada coordenador.
 *
 * Um dia depois do lembrete dos professores, e não junto: no domingo o
 * professor ainda pode lançar a pagela que faltou, e o resumo de segunda já
 * conta o que sobrou depois disso. Chega quando o coordenador tem a semana pela
 * frente para cobrar.
 */
@Injectable()
export class CoordinatorWeeklySummaryJob {
  constructor(
    private readonly jobRunner: JobRunnerService,
    private readonly notifyCoordinatorSummary: NotifyCoordinatorSummaryService,
  ) {}

  @Cron(JOB_SCHEDULES.coordinatorWeeklySummary, {
    name: ScheduledJobName.CoordinatorWeeklySummary,
    timeZone: SCHEDULING_TIMEZONE,
  })
  async handleCron(): Promise<void> {
    await this.jobRunner.run(ScheduledJobName.CoordinatorWeeklySummary, () =>
      // Dois dias atrás: o sábado da semana que fechou. Na segunda, "ontem" é
      // domingo, que já pertence à semana nova.
      this.notifyCoordinatorSummary
        .notifyForWeekOf(twoDaysAgo())
        .then(() => undefined),
    );
  }
}

/** Dois dias atrás, em horário local. */
function twoDaysAgo(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 2);
  return date;
}
