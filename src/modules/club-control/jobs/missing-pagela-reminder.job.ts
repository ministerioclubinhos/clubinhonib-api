import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import {
  JobRunnerService,
  JOB_SCHEDULES,
  SCHEDULING_TIMEZONE,
  ScheduledJobName,
} from 'src/shared/scheduling';

import { NotifyMissingPagelaService } from '../services/notify-missing-pagela.service';

/**
 * Domingo de manhã: lembra cada clubinho das pagelas que ficaram faltando na
 * semana que acabou de fechar.
 *
 * O domingo é a virada da semana do Clubinho — domingo nunca é dia de reunião,
 * então no domingo de manhã a semana anterior está fechada e nenhuma pagela
 * dela ainda chega a tempo. Às 8h, e não à meia-noite: um aviso de madrugada é
 * lido junto com o spam da noite.
 */
@Injectable()
export class MissingPagelaReminderJob {
  constructor(
    private readonly jobRunner: JobRunnerService,
    private readonly notifyMissingPagela: NotifyMissingPagelaService,
  ) {}

  @Cron(JOB_SCHEDULES.missingPagelaReminder, {
    name: ScheduledJobName.MissingPagelaReminder,
    timeZone: SCHEDULING_TIMEZONE,
  })
  async handleCron(): Promise<void> {
    await this.jobRunner.run(ScheduledJobName.MissingPagelaReminder, () =>
      // Ontem: o sábado que fechou a semana. A data de hoje cairia na semana
      // seguinte, que ainda não teve clubinho nenhum.
      this.notifyMissingPagela
        .notifyForWeekOf(yesterday())
        .then(() => undefined),
    );
  }
}

/** O dia anterior, em horário local. */
function yesterday(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
}
