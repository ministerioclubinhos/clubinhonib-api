import { RequestContextService } from 'src/core/request-context/request-context.service';
import { createExecutionContext } from 'src/core/request-context/utils';
import {
  LogRecordType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';
import { AuditStoragePort } from 'src/shared/providers/log-storage/ports/log-storage.port';
import {
  DedupClaimInput,
  LogRecord,
} from 'src/shared/providers/log-storage/types';
import { parseLogStorageConfig } from 'src/shared/providers/log-storage/utils';

import { AuditActionType, AuditOutcome } from '../enums';
import { AuditDeduplicationService } from './audit-deduplication.service';
import { WriteAuditEventService } from './write-audit-event.service';

const makeService = (
  dedupSeconds: string,
  claims: Map<string, { eventId: string; occurredAt: string }> = new Map(),
) => {
  const written: LogRecord[] = [];
  const storage = {
    write: jest.fn((record: LogRecord) => {
      written.push(record);
      return Promise.resolve();
    }),
    claimDedup: jest.fn((input: DedupClaimInput) => {
      const existing = claims.get(input.fingerprint);
      if (existing)
        return Promise.resolve({
          fingerprint: input.fingerprint,
          duplicateOf: existing,
        });
      claims.set(input.fingerprint, {
        eventId: input.eventId,
        occurredAt: input.occurredAt,
      });
      return Promise.resolve({
        fingerprint: input.fingerprint,
        duplicateOf: null,
      });
    }),
  } as unknown as AuditStoragePort;
  const config = parseLogStorageConfig(
    (key) => (key === 'AUDIT_DEDUP_SECONDS' ? dedupSeconds : undefined),
    '/srv/app',
  );
  const requestContext = new RequestContextService();
  const service = new WriteAuditEventService(
    storage,
    config,
    () => new Date('2026-09-05T12:00:00Z'),
    requestContext,
    new AuditDeduplicationService(storage, config),
  );
  return { service, storage, written, requestContext };
};

const httpCtx = (id: string) => {
  const ctx = createExecutionContext(LogSourceType.Http, Date.now(), id);
  ctx.controllerName = 'ClubsController';
  ctx.handlerName = 'create';
  ctx.moduleName = 'ClubsModule';
  ctx.httpMethod = 'POST';
  return ctx;
};

describe('WriteAuditEventService', () => {
  it('grava uma vez por request; a segunda chamada é ignorada', async () => {
    const { service, written, requestContext } = makeService('0');
    requestContext.run(httpCtx('r1'), () => {
      expect(
        service.recordHttpOutcome({
          statusCode: 200,
          errorCode: null,
          requestUrl: '/clubs',
        }),
      ).not.toBeNull();
      expect(
        service.recordHttpOutcome({
          statusCode: 500,
          errorCode: 'X',
          requestUrl: '/clubs',
        }),
      ).toBeNull();
    });
    await service.flush();
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      recordType: LogRecordType.Audit,
      outcome: AuditOutcome.Succeeded,
      dedupFingerprint: null,
    });
  });

  it('leitura (GET) não gera evento de auditoria', async () => {
    const { service, written, requestContext } = makeService('0');
    const ctx = httpCtx('r-get');
    ctx.httpMethod = 'GET';
    requestContext.run(ctx, () => {
      expect(
        service.recordHttpOutcome({
          statusCode: 200,
          errorCode: null,
          requestUrl: '/clubs',
        }),
      ).toBeNull();
    });
    await service.flush();
    expect(written).toHaveLength(0);
  });

  it('fora de um contexto não grava nada', async () => {
    const { service, written } = makeService('0');
    expect(
      service.recordHttpOutcome({
        statusCode: 200,
        errorCode: null,
        requestUrl: '/',
      }),
    ).toBeNull();
    await service.flush();
    expect(written).toHaveLength(0);
  });

  it('com janela ligada, o primeiro evento leva o fingerprint e o igual vira repetição', async () => {
    const { service, written, requestContext } = makeService('60');
    requestContext.run(httpCtx('r1'), () =>
      service.recordHttpOutcome({
        statusCode: 200,
        errorCode: null,
        requestUrl: '/clubs',
      }),
    );
    requestContext.run(httpCtx('r2'), () =>
      service.recordHttpOutcome({
        statusCode: 200,
        errorCode: null,
        requestUrl: '/clubs',
      }),
    );
    requestContext.run(httpCtx('r3'), () =>
      service.recordHttpOutcome({
        statusCode: 500,
        errorCode: 'INT_9001',
        requestUrl: '/clubs',
      }),
    );
    await service.flush();

    expect(written.map((r) => r.recordType)).toEqual([
      LogRecordType.Audit,
      LogRecordType.AuditRepeat,
      LogRecordType.Audit,
    ]);
    expect(written[0].dedupFingerprint).toEqual(expect.any(String));
    expect(written[1]).toMatchObject({
      repeatsEventId: written[0].eventId,
      requestId: 'r2',
    });
    expect(written[2].requestId).toBe('r3');
  });

  it('dedup quebrado não custa o evento', async () => {
    const { service, storage, written, requestContext } = makeService('60');
    (storage.claimDedup as jest.Mock).mockRejectedValueOnce(new Error('down'));
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    requestContext.run(httpCtx('r1'), () =>
      service.recordHttpOutcome({
        statusCode: 200,
        errorCode: null,
        requestUrl: '/',
      }),
    );
    await service.flush();
    expect(written).toHaveLength(1);
    jest.restoreAllMocks();
  });

  it('boundary grava com o contexto informado, uma vez', async () => {
    const { service, written } = makeService('0');
    const ctx = createExecutionContext(LogSourceType.Job);
    const descriptor = {
      actionType: AuditActionType.ScheduledJob,
      actionName: 'job-x',
      jobName: 'job-x',
    };
    expect(
      service.recordBoundaryOutcome(ctx, descriptor, {
        outcome: AuditOutcome.Succeeded,
        errorCode: null,
        statusCode: null,
      }),
    ).not.toBeNull();
    expect(
      service.recordBoundaryOutcome(ctx, descriptor, {
        outcome: AuditOutcome.Failed,
        errorCode: null,
        statusCode: null,
      }),
    ).toBeNull();
    await service.flush();
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      actionType: AuditActionType.ScheduledJob,
      jobName: 'job-x',
    });
  });
});
