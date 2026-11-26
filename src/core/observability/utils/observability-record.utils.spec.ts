import { UserRole } from 'src/core/auth/auth.types';
import { createExecutionContext } from 'src/core/request-context/utils';
import { AppInternalException, ErrorCode } from 'src/shared/exceptions';
import {
  LogActorType,
  LogRecordType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

import { LogLevel } from '../enums';
import { buildObservabilityRecord } from './observability-record.utils';

const now = new Date('2026-09-05T12:00:00.000Z');

describe('buildObservabilityRecord', () => {
  it('monta o item com request, ator, módulo, código e localização', () => {
    const ctx = createExecutionContext(
      LogSourceType.Http,
      now.getTime() - 120,
      'req-1',
    );
    ctx.actorType = LogActorType.User;
    ctx.actorId = 'user-1';
    ctx.actorRole = UserRole.ADMIN;
    ctx.httpMethod = 'POST';
    ctx.routeTemplate = '/clubs';
    ctx.handlerName = 'create';
    ctx.statusCode = 500;

    const error = new AppInternalException(
      ErrorCode.DATABASE_ERROR,
      'Falha no banco para joao@x.com',
    );
    const record = buildObservabilityRecord(
      {
        level: LogLevel.Error,
        context: 'ClubsService',
        message: '[INT_9002] Falha no banco',
        error,
        metadata: { body: { a: 1 }, operation: 'insert' },
      },
      {
        environment: 'test',
        ttlDays: 1,
        now,
        moduleName: 'ClubsModule',
        requestContext: ctx,
        root: process.cwd(),
      },
    );

    expect(record).toMatchObject({
      recordType: LogRecordType.Observability,
      environment: 'test',
      occurredAt: now.toISOString(),
      expiresAtEpochSeconds: Math.floor(now.getTime() / 1000) + 86_400,
      requestId: 'req-1',
      sourceType: LogSourceType.Http,
      actorType: LogActorType.User,
      actorId: 'user-1',
      actorRole: UserRole.ADMIN,
      level: LogLevel.Error,
      context: 'ClubsService',
      moduleName: 'ClubsModule',
      operation: 'create',
      errorName: 'AppInternalException',
      errorCode: ErrorCode.DATABASE_ERROR,
      httpMethod: 'POST',
      routeTemplate: '/clubs',
      statusCode: 500,
      durationMs: 120,
      metadata: { operation: 'insert' },
    });
    expect(record.errorMessage).not.toContain('joao@x.com');
    expect(record.stack).toContain('src/core/observability');
    expect(record.sourceFile).toMatch(/\.ts$/);
    expect(record.errorFingerprint).toHaveLength(16);
    expect(record.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sem contexto usa a fronteira informada, ator system e INT_9001 para erro desconhecido', () => {
    const record = buildObservabilityRecord(
      {
        level: LogLevel.Error,
        context: null,
        message: 'x',
        sourceType: LogSourceType.Bootstrap,
      },
      {
        environment: 'test',
        ttlDays: 1,
        now,
        moduleName: 'unknown-module',
        requestContext: null,
      },
    );
    expect(record).toMatchObject({
      requestId: null,
      sourceType: LogSourceType.Bootstrap,
      actorType: LogActorType.System,
      context: 'Application',
      errorCode: ErrorCode.INTERNAL_ERROR,
      durationMs: null,
      stack: null,
      metadata: null,
    });
  });

  it('código vindo do prefixo da mensagem do filtro', () => {
    const record = buildObservabilityRecord(
      {
        level: LogLevel.Error,
        context: 'GlobalExceptionFilter',
        message: '[INT_9003] Erro externo',
      },
      {
        environment: 'test',
        ttlDays: 1,
        now,
        moduleName: 'm',
        requestContext: null,
      },
    );
    expect(record.errorCode).toBe('INT_9003');
  });
});
