import { LogRecord } from 'src/shared/providers/log-storage/types';

import { toAuditResponse, toObservabilityResponse } from './mappers';

const base = {
  schemaVersion: '1',
  eventId: 'e1',
  environment: 'test',
  service: 'clubinhonib-api',
  occurredAt: '2026-09-05T12:00:00.000Z',
  expiresAtEpochSeconds: 1,
  requestId: 'r1',
  sourceType: 'http',
  actorType: 'user',
  actorId: 'u1',
  actorRole: 'admin',
};

describe('mappers', () => {
  it('observabilidade: sem stack, sem metadata, textos limitados', () => {
    const dto = toObservabilityResponse({
      ...base,
      recordType: 'observability',
      level: 'error',
      context: 'ClubsService',
      moduleName: 'ClubsModule',
      message: 'm'.repeat(600),
      stack: 'Error\n at x',
      metadata: { operation: 'x' },
      errorCode: 'INT_9001',
      statusCode: 500,
      sourceFile: 'src/a.ts',
      sourceLine: 3,
    } as unknown as LogRecord) as unknown as Record<string, unknown>;

    expect(dto).not.toHaveProperty('stack');
    expect(dto).not.toHaveProperty('metadata');
    expect(dto).not.toHaveProperty('expiresAtEpochSeconds');
    expect((dto.message as string).length).toBeLessThanOrEqual(512);
    expect(dto).toMatchObject({
      errorCode: 'INT_9001',
      statusCode: 500,
      sourceFile: 'src/a.ts',
      sourceLine: 3,
    });
  });

  it('auditoria: campos allowlisted e defaults seguros', () => {
    const dto = toAuditResponse({
      ...base,
      recordType: 'audit',
      actionType: 'http_request',
      actionName: 'ClubsModule.ClubsController.create',
      outcome: 'succeeded',
      statusCode: 201,
      durationMs: 12,
      occurrenceCount: 3,
      dedupFingerprint: 'abc',
    } as unknown as LogRecord) as unknown as Record<string, unknown>;

    expect(dto).not.toHaveProperty('dedupFingerprint');
    expect(dto).toMatchObject({
      actionName: 'ClubsModule.ClubsController.create',
      occurrenceCount: 3,
      durationMs: 12,
    });
  });
});
