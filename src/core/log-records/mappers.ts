import { AuditRecord } from 'src/core/audit/types';
import { truncate } from 'src/core/observability/utils/redaction.utils';
import { ObservabilityRecord } from 'src/core/observability/types';
import { LogRecordType } from 'src/shared/providers/log-storage/enums';
import { LogRecord } from 'src/shared/providers/log-storage/types';

import { LOG_RECORDS_MESSAGE_MAX_LENGTH } from './constants';
import { AuditRecordResponseDto } from './dto/audit-record-response.dto';
import { ObservabilityRecordResponseDto } from './dto/observability-record-response.dto';

const text = (value: unknown): string | null =>
  typeof value === 'string'
    ? truncate(value, LOG_RECORDS_MESSAGE_MAX_LENGTH)
    : null;
const str = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;
const num = (value: unknown): number | null =>
  typeof value === 'number' ? value : null;

/**
 * Item físico -> DTO público, campo a campo.
 *
 * O item já foi redigido ao ser gravado; ainda assim, só o que está aqui sai.
 * Um campo novo no storage não aparece na API por acidente.
 */
export function toObservabilityResponse(
  record: LogRecord,
): ObservabilityRecordResponseDto {
  const item = record as Partial<ObservabilityRecord>;
  return {
    schemaVersion: record.schemaVersion,
    eventId: record.eventId,
    recordType: LogRecordType.Observability,
    environment: record.environment,
    service: record.service,
    occurredAt: record.occurredAt,
    requestId: record.requestId,
    sourceType: record.sourceType,
    actorType: record.actorType,
    actorId: record.actorId,
    actorRole: record.actorRole,
    level: item.level as ObservabilityRecord['level'],
    context: str(item.context) ?? 'Application',
    moduleName: str(item.moduleName) ?? 'unknown-module',
    operation: str(item.operation),
    message: text(item.message) ?? '',
    errorName: str(item.errorName),
    errorCode: str(item.errorCode),
    errorMessage: text(item.errorMessage),
    errorFingerprint: str(item.errorFingerprint),
    sourceFile: str(item.sourceFile),
    sourceLine: num(item.sourceLine),
    httpMethod: str(item.httpMethod),
    routeTemplate: str(item.routeTemplate),
    statusCode: num(item.statusCode),
    durationMs: num(item.durationMs),
    providerName: str(item.providerName),
    jobName: str(item.jobName),
    occurrenceCount: num(item.occurrenceCount) ?? 1,
  };
}

export function toAuditResponse(record: LogRecord): AuditRecordResponseDto {
  const item = record as Partial<AuditRecord>;
  return {
    schemaVersion: record.schemaVersion,
    eventId: record.eventId,
    recordType: LogRecordType.Audit,
    environment: record.environment,
    service: record.service,
    occurredAt: record.occurredAt,
    requestId: record.requestId,
    sourceType: record.sourceType,
    actorType: record.actorType,
    actorId: record.actorId,
    actorRole: record.actorRole,
    actorName: str(item.actorName),
    actionType: item.actionType as AuditRecord['actionType'],
    actionName: str(item.actionName) ?? '',
    moduleName: str(item.moduleName),
    controllerName: str(item.controllerName),
    handlerName: str(item.handlerName),
    resourceType: str(item.resourceType),
    resourceId: str(item.resourceId),
    outcome: item.outcome as AuditRecord['outcome'],
    httpMethod: str(item.httpMethod),
    routeTemplate: str(item.routeTemplate),
    statusCode: num(item.statusCode),
    durationMs: num(item.durationMs) ?? 0,
    errorCode: str(item.errorCode),
    occurrenceCount: num(item.occurrenceCount) ?? 1,
    jobName: str(item.jobName),
  };
}
