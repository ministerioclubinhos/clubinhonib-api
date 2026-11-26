import { Test } from '@nestjs/testing';

import { JobRunnerService } from '../job-runner.service';
import { JobRunStatus, JobTask, ScheduledJobName } from '../types';
import { SchedulerHeartbeatJob } from './scheduler-heartbeat.job';

describe('SchedulerHeartbeatJob', () => {
  /**
   * O job não decide se roda nem trata erro: ele entrega o trabalho ao runner.
   * O mock executa a tarefa recebida, que é o contrato que interessa aqui.
   */
  const run = jest
    .fn()
    .mockImplementation(async (job: ScheduledJobName, task: JobTask) => {
      await task();
      return { job, status: JobRunStatus.Completed, durationMs: 0 };
    });

  async function buildJob(): Promise<SchedulerHeartbeatJob> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SchedulerHeartbeatJob,
        { provide: JobRunnerService, useValue: { run } },
      ],
    }).compile();

    return moduleRef.get(SchedulerHeartbeatJob);
  }

  beforeEach(() => run.mockClear());

  it('entrega o trabalho ao runner sob o nome do job', async () => {
    const job = await buildJob();

    await job.handleCron();

    expect(run).toHaveBeenCalledWith(
      ScheduledJobName.SchedulerHeartbeat,
      expect.any(Function),
    );
  });

  it('não lança quando o runner reporta falha', async () => {
    run.mockResolvedValueOnce({
      job: ScheduledJobName.SchedulerHeartbeat,
      status: JobRunStatus.Failed,
      durationMs: 1,
      error: 'falhou',
    });
    const job = await buildJob();

    await expect(job.handleCron()).resolves.toBeUndefined();
  });
});
