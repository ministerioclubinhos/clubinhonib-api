import { ComponentsRegistry } from 'src/core/request-context/discovery/components.registry';
import { RequestContextService } from 'src/core/request-context/request-context.service';
import { createExecutionContext } from 'src/core/request-context/utils';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';
import { ObservabilityStoragePort } from 'src/shared/providers/log-storage/ports/log-storage.port';
import {
  LogRecord,
  LogStorageConfig,
} from 'src/shared/providers/log-storage/types';
import { parseLogStorageConfig } from 'src/shared/providers/log-storage/utils';

import { LogLevel } from '../enums';
import { WriteTechnicalLogService } from './write-technical-log.service';

describe('WriteTechnicalLogService', () => {
  const written: LogRecord[] = [];
  const storage = {
    write: jest.fn((record: LogRecord) => {
      written.push(record);
      return Promise.resolve();
    }),
  } as unknown as ObservabilityStoragePort;
  const config: LogStorageConfig = parseLogStorageConfig(
    (key) => (key === 'ENVIRONMENT' ? 'test' : undefined),
    '/srv/app',
  );
  const registry = {
    moduleOf: jest.fn(() => 'ClubsModule'),
  } as unknown as ComponentsRegistry;
  const requestContext = new RequestContextService();
  const service = new WriteTechnicalLogService(
    storage,
    config,
    () => new Date('2026-09-05T00:00:00Z'),
    requestContext,
    registry,
  );

  beforeEach(() => written.splice(0));

  it('persiste error e fatal; ignora warn e log', async () => {
    expect(
      service.report({ level: LogLevel.Warn, context: 'X', message: 'w' }),
    ).toBeNull();
    expect(
      service.report({ level: LogLevel.Log, context: 'X', message: 'l' }),
    ).toBeNull();
    const error = service.report({
      level: LogLevel.Error,
      context: 'ClubsService',
      message: 'e',
    });
    const fatal = service.report({
      level: LogLevel.Fatal,
      context: 'X',
      message: 'f',
    });
    await service.flush();

    expect(written.map((r) => r.eventId)).toEqual([
      error?.eventId,
      fatal?.eventId,
    ]);
    expect(error).toMatchObject({
      moduleName: 'ClubsModule',
      level: LogLevel.Error,
    });
    expect(service.stats()).toMatchObject({ written: 2, dropped: 0 });
  });

  it('herda o contexto da execução em curso', () => {
    const ctx = createExecutionContext(
      LogSourceType.Job,
      Date.now(),
      'job-run-1',
    );
    ctx.jobName = 'missing-pagela-reminder';
    requestContext.run(ctx, () => {
      const record = service.build({
        level: LogLevel.Error,
        context: 'JobRunnerService',
        message: 'falhou',
      });
      expect(record).toMatchObject({
        requestId: 'job-run-1',
        jobName: 'missing-pagela-reminder',
        sourceType: LogSourceType.Job,
      });
    });
  });
});
