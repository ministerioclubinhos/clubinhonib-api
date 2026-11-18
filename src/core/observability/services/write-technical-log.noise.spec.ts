import { BadRequestException } from '@nestjs/common';

import { ComponentsRegistry } from 'src/core/request-context/discovery/components.registry';
import { RequestContextService } from 'src/core/request-context/request-context.service';
import { createExecutionContext } from 'src/core/request-context/utils';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';
import { ObservabilityStoragePort } from 'src/shared/providers/log-storage/ports/log-storage.port';
import { LogRecord } from 'src/shared/providers/log-storage/types';
import { parseLogStorageConfig } from 'src/shared/providers/log-storage/utils';

import { REPEAT_WINDOW_MS } from '../constants';
import { LogLevel } from '../enums';
import { ObservabilityRecord } from '../types';
import {
  isPersistedClientError,
  messageShape,
} from '../utils/technical-log-noise.utils';
import { WriteTechnicalLogService } from './write-technical-log.service';

describe('filtro de ruído da observabilidade', () => {
  const make = () => {
    const written: ObservabilityRecord[] = [];
    const storage = {
      write: jest.fn((record: LogRecord) => {
        written.push(record as ObservabilityRecord);
        return Promise.resolve();
      }),
    } as unknown as ObservabilityStoragePort;
    const clock = { now: new Date('2026-09-05T00:00:00Z') };
    const requestContext = new RequestContextService();
    const service = new WriteTechnicalLogService(
      storage,
      parseLogStorageConfig(() => undefined, '/srv/app'),
      () => clock.now,
      requestContext,
      { moduleOf: () => 'M' } as unknown as ComponentsRegistry,
    );
    const advance = (ms: number) => {
      clock.now = new Date(clock.now.getTime() + ms);
    };
    return { service, written, requestContext, advance };
  };
  const failure = (recipient: number) => ({
    level: LogLevel.Error,
    context: 'EmailService',
    message: `Falha ao enviar para o destinatário ${recipient}.`,
  });

  it('decide quais 4xx são erro útil', () => {
    expect(isPersistedClientError(400, 'create')).toBe(true);
    expect(isPersistedClientError(403, 'remove')).toBe(true);
    expect(isPersistedClientError(404, 'findOne')).toBe(true);
    expect(isPersistedClientError(409, 'create')).toBe(true);
    expect(isPersistedClientError(422, 'create')).toBe(true);
    // Token ausente/expirado e senha errada.
    expect(isPersistedClientError(401, 'login')).toBe(false);
    // Varredura de rota que não existe.
    expect(isPersistedClientError(404, null)).toBe(false);
    expect(isPersistedClientError(500, 'create')).toBe(false);
    expect(isPersistedClientError(200, 'create')).toBe(false);
  });

  it('compara mensagens pela forma, sem ids nem números', () => {
    expect(
      messageShape('Geração 0f8fad5b-d9cb-469f-a165-70867728950e item 12'),
    ).toBe('Geração :id item :n');
  });

  it('166 falhas iguais viram o primeiro registro e um resumo', async () => {
    const { service, written, advance } = make();
    const first = service.report(failure(1));
    for (let index = 2; index <= 166; index += 1) {
      advance(10);
      expect(service.report(failure(index))).toBeNull();
    }
    // Outro problema no mesmo intervalo não é confundido.
    expect(
      service.report({ ...failure(1), context: 'SmtpService' }),
    ).not.toBeNull();
    advance(REPEAT_WINDOW_MS);
    // A próxima ocorrência fecha a janela anterior e abre outra.
    const next = service.report(failure(167));
    await service.flush();

    const email = written.filter((item) => item.context === 'EmailService');
    expect(email).toHaveLength(3);
    expect(email[0].eventId).toBe(first?.eventId);
    expect(email[0].occurrenceCount).toBe(1);
    const summary = email.find((item) => item.occurrenceCount > 1);
    expect(summary?.occurrenceCount).toBe(165);
    expect(summary?.message).toContain('[repetido 165x em 60s]');
    expect(summary?.eventId).not.toBe(first?.eventId);
    expect(email.some((item) => item.eventId === next?.eventId)).toBe(true);
  });

  it('o encerramento grava o resumo das janelas ainda abertas', async () => {
    const { service, written } = make();
    service.report(failure(1));
    service.report(failure(2));
    await service.flush();
    expect(written.map((item) => item.occurrenceCount)).toEqual([1, 1]);
    expect(written[1].message).toContain('[repetido 1x');
  });

  it('fatal nunca é agregado', async () => {
    const { service, written } = make();
    const fatal = { level: LogLevel.Fatal, context: 'X', message: 'caiu' };
    service.report(fatal);
    service.report(fatal);
    await service.flush();
    expect(written).toHaveLength(2);
  });

  it('o filtro global não repete o erro que um serviço da mesma request já registrou', async () => {
    const { service, written, requestContext } = make();
    const ctx = createExecutionContext(LogSourceType.Http);
    ctx.handlerName = 'generate';
    requestContext.run(ctx, () => {
      service.report({
        level: LogLevel.Error,
        context: 'LessonDraftService',
        message: 'Geração falhou: provedor recusou a chave',
      });
      expect(
        service.report({
          level: LogLevel.Error,
          context: 'GlobalExceptionFilter',
          message: '[INT_9001] Erro interno do servidor',
        }),
      ).toBeNull();
    });
    // Sem registro anterior na request, o do filtro é o único e entra.
    requestContext.run(createExecutionContext(LogSourceType.Http), () => {
      expect(
        service.report({
          level: LogLevel.Error,
          context: 'GlobalExceptionFilter',
          message: '[INT_9001] Erro interno do servidor',
        }),
      ).not.toBeNull();
    });
    await service.flush();
    expect(written.map((item) => item.context)).toEqual([
      'LessonDraftService',
      'GlobalExceptionFilter',
    ]);
  });

  it('resposta 4xx útil vira registro warn; 401 e rota inexistente não', async () => {
    const { service, written, requestContext } = make();
    const run = (handlerName: string | null, statusCode: number) => {
      const ctx = createExecutionContext(LogSourceType.Http);
      ctx.handlerName = handlerName;
      ctx.statusCode = statusCode;
      return requestContext.run(ctx, () =>
        service.reportClientError({
          statusCode,
          context: 'GlobalExceptionFilter',
          message: `[VAL_4001] recusado ${statusCode}`,
          error: new BadRequestException('recusado'),
        }),
      );
    };
    expect(run('create', 400)?.level).toBe(LogLevel.Warn);
    expect(run('login', 401)).toBeNull();
    expect(run(null, 404)).toBeNull();
    await service.flush();
    expect(written).toHaveLength(1);
    expect(written[0].statusCode).toBe(400);
  });
});
