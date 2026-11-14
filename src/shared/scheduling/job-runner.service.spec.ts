import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { SCHEDULING_ENABLED_ENV } from './constants';
import { JobRunnerService } from './job-runner.service';
import { JobRunStatus, JobSkipReason, ScheduledJobName } from './types';

const JOB = ScheduledJobName.SchedulerHeartbeat;

/** Sobe o runner com o valor que `SCHEDULER_ENABLED` teria naquele ambiente. */
async function buildRunner(enabled: string | undefined) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      JobRunnerService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string): string | undefined =>
            key === SCHEDULING_ENABLED_ENV ? enabled : undefined,
        },
      },
    ],
  }).compile();

  return moduleRef.get(JobRunnerService);
}

describe('JobRunnerService', () => {
  beforeAll(() => {
    // O runner registra início, fim e falha; a suíte não precisa do barulho.
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  describe('quando o agendador está desligado', () => {
    it.each(['false', '0', '', ' ', undefined])(
      'não executa o trabalho com SCHEDULER_ENABLED=%p',
      async (value) => {
        const runner = await buildRunner(value);
        const task = jest.fn().mockResolvedValue(undefined);

        const result = await runner.run(JOB, task);

        expect(task).not.toHaveBeenCalled();
        expect(result.status).toBe(JobRunStatus.Skipped);
        expect(result.skipReason).toBe(JobSkipReason.SchedulerDisabled);
      },
    );
  });

  describe('quando o agendador está ligado', () => {
    it.each(['true', 'TRUE', '1', ' true '])(
      'executa o trabalho com SCHEDULER_ENABLED=%p',
      async (value) => {
        const runner = await buildRunner(value);
        const task = jest.fn().mockResolvedValue(undefined);

        const result = await runner.run(JOB, task);

        expect(task).toHaveBeenCalledTimes(1);
        expect(result.status).toBe(JobRunStatus.Completed);
      },
    );

    /**
     * O decorador `@Cron` não tem a quem devolver um erro: se ele escapar, vira
     * rejeição não tratada e derruba o processo da API inteira por causa de um
     * aviso que não saiu.
     */
    it('não propaga o erro de um job que falha', async () => {
      const runner = await buildRunner('true');
      const task = jest.fn().mockRejectedValue(new Error('SMTP fora do ar'));

      const result = await runner.run(JOB, task);

      expect(result.status).toBe(JobRunStatus.Failed);
      expect(result.error).toBe('SMTP fora do ar');
    });

    it('registra a falha de um job que lança algo que não é Error', async () => {
      const runner = await buildRunner('true');
      const task = jest.fn().mockRejectedValue('caiu');

      const result = await runner.run(JOB, task);

      expect(result.status).toBe(JobRunStatus.Failed);
      expect(result.error).toBe('caiu');
    });

    /**
     * Um job mais lento que o intervalo entre disparos acumularia execuções
     * paralelas disputando o mesmo banco — e mandando o mesmo e-mail duas vezes.
     */
    it('dispensa o disparo enquanto a execução anterior não termina', async () => {
      const runner = await buildRunner('true');
      let release: () => void = () => undefined;
      const task = jest
        .fn()
        .mockImplementation(
          () => new Promise<void>((resolve) => (release = resolve)),
        );

      const first = runner.run(JOB, task);
      const second = await runner.run(JOB, task);

      expect(second.status).toBe(JobRunStatus.Skipped);
      expect(second.skipReason).toBe(JobSkipReason.AlreadyRunning);
      expect(task).toHaveBeenCalledTimes(1);

      release();
      await expect(first).resolves.toMatchObject({
        status: JobRunStatus.Completed,
      });
    });

    /** A trava some quando o job termina, inclusive quando ele falha. */
    it('libera o job para o disparo seguinte depois de uma falha', async () => {
      const runner = await buildRunner('true');
      const failing = jest.fn().mockRejectedValue(new Error('falhou'));
      const succeeding = jest.fn().mockResolvedValue(undefined);

      await runner.run(JOB, failing);
      const result = await runner.run(JOB, succeeding);

      expect(succeeding).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(JobRunStatus.Completed);
    });

    /** A trava é por job: um não pode segurar o disparo do outro. */
    it('não bloqueia um job diferente', async () => {
      const runner = await buildRunner('true');
      const other = 'outro-job' as ScheduledJobName;
      let release: () => void = () => undefined;

      const first = runner.run(
        JOB,
        () => new Promise<void>((resolve) => (release = resolve)),
      );
      const second = await runner.run(other, () => Promise.resolve());

      expect(second.status).toBe(JobRunStatus.Completed);

      release();
      await first;
    });
  });
});
