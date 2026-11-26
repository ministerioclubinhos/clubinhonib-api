import { UserRole } from 'src/core/auth/auth.types';
import { createExecutionContext } from 'src/core/request-context/utils';
import {
  LogActorType,
  LogRecordType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

import { AuditActionType, AuditOutcome } from '../enums';
import { auditFingerprint } from './audit-fingerprint.utils';
import {
  buildBoundaryAuditRecord,
  buildHttpAuditRecord,
  buildRepeatRecord,
} from './audit-record.utils';

const now = new Date('2026-09-05T12:00:00.000Z');
const env = { environment: 'test', ttlDays: 2, now };

describe('buildHttpAuditRecord', () => {
  it('ação resolvida: nome automático, recurso, ator e resultado', () => {
    const ctx = createExecutionContext(
      LogSourceType.Http,
      now.getTime() - 35,
      'req-1',
    );
    ctx.moduleName = 'ClubsModule';
    ctx.controllerName = 'ClubsController';
    ctx.handlerName = 'toggleActive';
    ctx.routeTemplate = '/clubs/:id/toggle-active';
    ctx.httpMethod = 'PATCH';
    ctx.resourceType = 'clubs';
    ctx.resourceId = 'club-1';
    ctx.actorType = LogActorType.User;
    ctx.actorId = 'user-1';
    ctx.actorRole = UserRole.COORDINATOR;

    const record = buildHttpAuditRecord(
      ctx,
      {
        statusCode: 200,
        errorCode: null,
        requestUrl: '/clubs/club-1/toggle-active',
      },
      env,
    );

    expect(record).toMatchObject({
      recordType: LogRecordType.Audit,
      actionType: AuditActionType.HttpRequest,
      actionName: 'ClubsModule.ClubsController.toggleActive',
      resourceType: 'clubs',
      resourceId: 'club-1',
      outcome: AuditOutcome.Succeeded,
      httpMethod: 'PATCH',
      statusCode: 200,
      durationMs: 35,
      actorId: 'user-1',
      actorRole: UserRole.COORDINATOR,
      occurrenceCount: 1,
      expiresAtEpochSeconds: Math.floor(now.getTime() / 1000) + 2 * 86_400,
    });
    expect(record).not.toHaveProperty('body');
  });

  it('request sem handler (404) ganha nome de boundary sanitizado', () => {
    const ctx = createExecutionContext(
      LogSourceType.Http,
      now.getTime(),
      'req-2',
    );
    ctx.httpMethod = 'GET';
    const record = buildHttpAuditRecord(
      ctx,
      { statusCode: 404, errorCode: 'RES_5001', requestUrl: '/nada/123?x=1' },
      env,
    );
    expect(record).toMatchObject({
      actionName: 'http.unmatched.GET /nada/:id',
      outcome: AuditOutcome.NotFound,
      errorCode: 'RES_5001',
      actorType: LogActorType.Anonymous,
    });
  });
});

describe('buildBoundaryAuditRecord', () => {
  it('job agendado como ator system', () => {
    const ctx = createExecutionContext(
      LogSourceType.Job,
      now.getTime() - 1000,
      'run-1',
    );
    const record = buildBoundaryAuditRecord(
      ctx,
      {
        actionType: AuditActionType.ScheduledJob,
        actionName: 'missing-pagela-reminder',
        jobName: 'missing-pagela-reminder',
      },
      { outcome: AuditOutcome.Failed, errorCode: null, statusCode: null },
      env,
    );
    expect(record).toMatchObject({
      actionType: AuditActionType.ScheduledJob,
      actionName: 'missing-pagela-reminder',
      jobName: 'missing-pagela-reminder',
      actorType: LogActorType.System,
      outcome: AuditOutcome.Failed,
      durationMs: 1000,
      httpMethod: null,
    });
  });
});

describe('fingerprint e repetição', () => {
  const base = () => {
    const ctx = createExecutionContext(
      LogSourceType.Http,
      now.getTime(),
      `req-${Math.random()}`,
    );
    ctx.controllerName = 'C';
    ctx.handlerName = 'h';
    ctx.actorId = 'u';
    return buildHttpAuditRecord(
      ctx,
      { statusCode: 200, errorCode: null, requestUrl: '/' },
      env,
    );
  };

  it('mesma ação em requests diferentes tem o mesmo fingerprint; outra ação, outro', () => {
    const a = base();
    const b = base();
    expect(a.requestId).not.toBe(b.requestId);
    expect(auditFingerprint(a)).toBe(auditFingerprint(b));
    expect(auditFingerprint({ ...a, outcome: AuditOutcome.Failed })).not.toBe(
      auditFingerprint(a),
    );
    expect(auditFingerprint(a)).toHaveLength(32);
  });

  it('repetição aponta para o primeiro evento e não copia o restante', () => {
    const first = base();
    const second = base();
    const repeat = buildRepeatRecord(second, 'fp', {
      eventId: first.eventId,
      occurredAt: first.occurredAt,
    });
    expect(repeat).toMatchObject({
      recordType: LogRecordType.AuditRepeat,
      eventId: second.eventId,
      repeatsEventId: first.eventId,
      dedupFingerprint: 'fp',
    });
    expect(repeat).not.toHaveProperty('routeTemplate');
  });
});
