import { EventEmitter } from 'node:events';

import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import { LogLevel } from '../enums';
import { WriteTechnicalLogService } from '../services/write-technical-log.service';
import { ProcessErrorListenersService } from './process-error-listeners.service';

describe('ProcessErrorListenersService', () => {
  const report = jest.fn();
  const flush = jest.fn(() => Promise.resolve());
  const exit = jest.fn();
  const fakeProcess = new EventEmitter() as unknown as NodeJS.Process;
  const service = new ProcessErrorListenersService({
    report,
    flush,
  } as unknown as WriteTechnicalLogService).bindTo(fakeProcess, exit);

  beforeEach(() => {
    report.mockClear();
    flush.mockClear();
    exit.mockClear();
  });

  it('registra rejeição não tratada e mantém o processo', () => {
    service.onApplicationBootstrap();
    (fakeProcess as unknown as EventEmitter).emit(
      'unhandledRejection',
      new Error('sem catch'),
    );

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.Error,
        sourceType: LogSourceType.Process,
      }),
    );
    expect(exit).not.toHaveBeenCalled();
  });

  it('exceção não capturada é fatal: registra, drena e encerra', async () => {
    (fakeProcess as unknown as EventEmitter).emit(
      'uncaughtException',
      new Error('fatal'),
    );
    await new Promise((done) => setImmediate(done));

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ level: LogLevel.Fatal }),
    );
    expect(flush).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('remove os listeners no shutdown', () => {
    service.onApplicationShutdown();
    expect(
      (fakeProcess as unknown as EventEmitter).listenerCount(
        'unhandledRejection',
      ),
    ).toBe(0);
    expect(
      (fakeProcess as unknown as EventEmitter).listenerCount(
        'uncaughtException',
      ),
    ).toBe(0);
  });
});
