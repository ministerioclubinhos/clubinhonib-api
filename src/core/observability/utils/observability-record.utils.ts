import { randomUUID } from 'node:crypto';

import { RequestExecutionContext } from 'src/core/request-context/types';
import { ErrorCode } from 'src/shared/exceptions/error-codes.enum';
import { LOG_SERVICE_NAME } from 'src/shared/providers/log-storage/constants';
import {
  LogActorType,
  LogRecordType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';
import { expiresAtEpochSeconds } from 'src/shared/providers/log-storage/utils';

import { MESSAGE_MAX_LENGTH, OBSERVABILITY_SCHEMA_VERSION } from '../constants';
import { LogLevel } from '../enums';
import { ObservabilityRecord, TechnicalLogInput } from '../types';
import { leadingErrorCode, normalizeError } from './error-normalizer.utils';
import { redactMetadata, redactText } from './redaction.utils';
import {
  errorFingerprint,
  parseStackFrames,
  sanitizeStack,
  sourceLocationOf,
} from './stack-location.utils';

export interface ObservabilityRecordEnvironment {
  environment: string;
  ttlDays: number;
  now: Date;
  moduleName: string;
  requestContext: RequestExecutionContext | null;
  root?: string;
}

/**
 * Monta o item técnico campo a campo.
 *
 * Função pura para o writer de bootstrap, o logger e os testes montarem o
 * mesmo formato sem passar pela injeção.
 */
export function buildObservabilityRecord(
  input: TechnicalLogInput,
  env: ObservabilityRecordEnvironment,
): ObservabilityRecord {
  const normalized = normalizeError(input.error);
  const stackSource = input.stack ?? normalized.stack;
  const frames = parseStackFrames(stackSource, env.root);
  const location = sourceLocationOf(frames);
  const ctx = env.requestContext;
  const message = redactText(input.message, MESSAGE_MAX_LENGTH);
  const codeFromMessage = leadingErrorCode(input.message);
  const errorCode =
    normalized.code ??
    codeFromMessage ??
    ctx?.errorCode ??
    (input.level === LogLevel.Error || input.level === LogLevel.Fatal
      ? ErrorCode.INTERNAL_ERROR
      : null);

  return {
    schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
    eventId: randomUUID(),
    recordType: LogRecordType.Observability,
    environment: env.environment,
    service: LOG_SERVICE_NAME,
    occurredAt: env.now.toISOString(),
    expiresAtEpochSeconds: expiresAtEpochSeconds(env.now, env.ttlDays),
    requestId: ctx?.requestId ?? null,
    sourceType: ctx?.sourceType ?? input.sourceType ?? LogSourceType.Process,
    actorType: ctx?.actorType ?? LogActorType.System,
    actorId: ctx?.actorId ?? null,
    actorRole: ctx?.actorRole ?? null,
    level: input.level,
    context: input.context ?? 'Application',
    moduleName: env.moduleName,
    operation: input.operation ?? ctx?.handlerName ?? null,
    message,
    errorName:
      normalized.name ??
      (stackSource ? stackSource.split(':')[0]?.trim() || null : null),
    errorCode,
    errorMessage: normalized.message,
    stack: sanitizeStack(stackSource, env.root),
    ...location,
    errorFingerprint: errorFingerprint(normalized.name, errorCode, frames),
    httpMethod: ctx?.httpMethod ?? null,
    routeTemplate: ctx?.routeTemplate ?? null,
    statusCode: normalized.statusCode ?? ctx?.statusCode ?? null,
    durationMs: ctx
      ? Math.max(0, env.now.getTime() - ctx.startedAtEpochMs)
      : null,
    providerName: input.providerName ?? null,
    jobName: ctx?.jobName ?? null,
    metadata: redactMetadata(input.metadata),
    occurrenceCount: 1,
  };
}
