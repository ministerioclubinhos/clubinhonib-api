import { randomUUID } from 'node:crypto';

import {
  actorNameSearchKey,
  unmatchedRouteName,
} from 'src/core/request-context/utils';
import { RequestExecutionContext } from 'src/core/request-context/types';
import { LOG_SERVICE_NAME } from 'src/shared/providers/log-storage/constants';
import { LogRecordType } from 'src/shared/providers/log-storage/enums';
import { DedupReference } from 'src/shared/providers/log-storage/types';
import { expiresAtEpochSeconds } from 'src/shared/providers/log-storage/utils';

import { AUDIT_SCHEMA_VERSION } from '../constants';
import { AuditActionType } from '../enums';
import {
  AuditRecord,
  AuditRepeatRecord,
  BoundaryDescriptor,
  BoundaryOutcomeInput,
  HttpOutcomeInput,
} from '../types';
import {
  httpActionName,
  httpMethodOf,
  outcomeFromStatus,
} from './audit-event.utils';

export interface AuditRecordEnvironment {
  environment: string;
  ttlDays: number;
  now: Date;
}

const baseOf = (ctx: RequestExecutionContext, env: AuditRecordEnvironment) => ({
  schemaVersion: AUDIT_SCHEMA_VERSION,
  eventId: randomUUID(),
  recordType: LogRecordType.Audit as const,
  environment: env.environment,
  service: LOG_SERVICE_NAME,
  occurredAt: env.now.toISOString(),
  expiresAtEpochSeconds: expiresAtEpochSeconds(env.now, env.ttlDays),
  requestId: ctx.requestId,
  sourceType: ctx.sourceType,
  actorType: ctx.actorType,
  actorId: ctx.actorId,
  actorRole: ctx.actorRole,
  actorName: ctx.actorName,
  actorNameSearch: ctx.actorName ? actorNameSearchKey(ctx.actorName) : null,
  durationMs: Math.max(0, env.now.getTime() - ctx.startedAtEpochMs),
  dedupFingerprint: null,
  occurrenceCount: 1,
});

/** Evento de uma request HTTP, com ou sem handler resolvido. */
export function buildHttpAuditRecord(
  ctx: RequestExecutionContext,
  outcome: HttpOutcomeInput,
  env: AuditRecordEnvironment,
): AuditRecord {
  const actionName =
    httpActionName(ctx.moduleName, ctx.controllerName, ctx.handlerName) ??
    unmatchedRouteName(ctx.httpMethod ?? 'GET', outcome.requestUrl ?? '/');
  return {
    ...baseOf(ctx, env),
    actionType: AuditActionType.HttpRequest,
    actionName,
    moduleName: ctx.moduleName,
    controllerName: ctx.controllerName,
    handlerName: ctx.handlerName,
    resourceType: ctx.resourceType,
    resourceId: ctx.resourceId,
    outcome: outcomeFromStatus(outcome.statusCode),
    httpMethod: httpMethodOf(ctx.httpMethod),
    routeTemplate: ctx.routeTemplate,
    statusCode: outcome.statusCode,
    errorCode: outcome.errorCode,
    jobName: null,
  };
}

/** Evento de uma fronteira sem HTTP (job agendado, operação de sistema). */
export function buildBoundaryAuditRecord(
  ctx: RequestExecutionContext,
  descriptor: BoundaryDescriptor,
  outcome: BoundaryOutcomeInput,
  env: AuditRecordEnvironment,
): AuditRecord {
  return {
    ...baseOf(ctx, env),
    actionType: descriptor.actionType,
    actionName: descriptor.actionName,
    moduleName: ctx.moduleName,
    controllerName: null,
    handlerName: descriptor.actionName,
    resourceType: null,
    resourceId: null,
    outcome: outcome.outcome,
    httpMethod: null,
    routeTemplate: null,
    statusCode: outcome.statusCode,
    errorCode: outcome.errorCode,
    jobName: descriptor.jobName,
  };
}

/** A repetição aponta para o primeiro evento da janela; nada mais é copiado. */
export function buildRepeatRecord(
  record: AuditRecord,
  fingerprint: string,
  reference: DedupReference,
): AuditRepeatRecord {
  return {
    schemaVersion: record.schemaVersion,
    eventId: record.eventId,
    recordType: LogRecordType.AuditRepeat,
    environment: record.environment,
    service: record.service,
    occurredAt: record.occurredAt,
    expiresAtEpochSeconds: record.expiresAtEpochSeconds,
    requestId: record.requestId,
    sourceType: record.sourceType,
    actorType: record.actorType,
    actorId: record.actorId,
    actorRole: record.actorRole,
    repeatsEventId: reference.eventId,
    repeatsOccurredAt: reference.occurredAt,
    dedupFingerprint: fingerprint,
    actionName: record.actionName,
    outcome: record.outcome,
  };
}
