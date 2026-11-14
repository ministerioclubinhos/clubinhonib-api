import { Logger } from '@nestjs/common';

import { LogLevel } from '../enums';
import { WriteTechnicalLogService } from '../services/write-technical-log.service';
import { StructuredLoggerService } from './structured-logger.service';

describe('StructuredLoggerService', () => {
  const report = jest.fn();
  const technicalLog = { report } as unknown as WriteTechnicalLogService;
  let logger: StructuredLoggerService;

  beforeEach(() => {
    report.mockReset();
    logger = new StructuredLoggerService(technicalLog);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('error persiste com stack e contexto separados', () => {
    const stack = 'Error: x\n    at f (/a.ts:1:1)';
    logger.error('[INT_9001] deu ruim', stack, 'ClubsService');

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.Error,
        context: 'ClubsService',
        message: '[INT_9001] deu ruim',
        stack,
      }),
    );
  });

  it('cobre o Logger do Nest instalado globalmente, sem mudar as chamadas existentes', () => {
    Logger.overrideLogger(logger);
    new Logger('PagelasService').error('falhou', new Error('boom').stack);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'PagelasService', message: 'falhou' }),
    );
    Logger.overrideLogger(false);
  });

  it('warn e log não persistem', () => {
    logger.warn('aviso', 'Ctx');
    logger.log('info', 'Ctx');
    expect(report).not.toHaveBeenCalled();
  });

  it('fatal persiste como fatal', () => {
    logger.fatal('fim', 'Ctx');
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ level: LogLevel.Fatal }),
    );
  });

  it('falha ao persistir não escapa para quem logou', () => {
    report.mockImplementation(() => {
      throw new Error('storage quebrado');
    });
    expect(() => logger.error('x', 'Ctx')).not.toThrow();
  });
});
