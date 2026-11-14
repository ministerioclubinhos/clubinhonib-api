import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { JobRunnerService } from './job-runner.service';
import { SchedulerHeartbeatJob } from './jobs/scheduler-heartbeat.job';

/**
 * O agendador da aplicação.
 *
 * `ScheduleModule.forRoot()` só varre os decoradores e registra os horários; o
 * que decide se algo executa é `SCHEDULER_ENABLED`, lido a cada disparo pelo
 * `JobRunnerService`. Registrar sempre e executar sob condição é de propósito:
 * assim o grafo de injeção é o mesmo em todo ambiente, e um job quebrado
 * aparece na subida em vez de só na instância que dispara.
 *
 * Cada job novo entra em `jobs/` e é declarado aqui. O módulo não exporta os
 * jobs — ninguém deve chamá-los por fora, ou o mesmo trabalho passa a ter dois
 * gatilhos. `JobRunnerService` é exportado para um job de outro módulo poder
 * usar a mesma engrenagem.
 */
@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [JobRunnerService, SchedulerHeartbeatJob],
  exports: [JobRunnerService],
})
export class SchedulingModule {}
