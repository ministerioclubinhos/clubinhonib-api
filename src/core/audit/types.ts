import { LogRecord } from 'src/shared/providers/log-storage/types';

import { AuditActionType, AuditOutcome } from './enums';

/** Evento de auditoria como vai para o storage. */
export interface AuditRecord extends LogRecord {
  /** Nome de exibição de quem agiu (decisão do solicitante, 2026-11-11). */
  actorName: string | null;
  /** O mesmo nome em minúsculas e sem acento, para o filtro por trecho. */
  actorNameSearch: string | null;
  actionType: AuditActionType;
  /** `<Module>.<Controller>.<handler>` para HTTP; o nome do job para jobs. */
  actionName: string;
  moduleName: string | null;
  controllerName: string | null;
  handlerName: string | null;
  resourceType: string | null;
  resourceId: string | null;
  outcome: AuditOutcome;
  httpMethod: string | null;
  routeTemplate: string | null;
  statusCode: number | null;
  durationMs: number;
  errorCode: string | null;
  dedupFingerprint: string | null;
  occurrenceCount: number;
  jobName: string | null;
}

/** Repetição de um evento dentro da janela de desduplicação (D-004). */
export interface AuditRepeatRecord extends LogRecord {
  repeatsEventId: string;
  repeatsOccurredAt: string;
  dedupFingerprint: string;
  actionName: string;
  outcome: AuditOutcome;
}

/** O que o interceptor ou o filtro sabem ao fim de uma request. */
export interface HttpOutcomeInput {
  statusCode: number;
  errorCode: string | null;
  /** URL crua, usada só para nomear uma request sem handler (404). */
  requestUrl: string | null;
}

/** Ação fora do HTTP (job, operação de sistema). */
export interface BoundaryDescriptor {
  actionType: AuditActionType;
  actionName: string;
  jobName: string | null;
}

export interface BoundaryOutcomeInput {
  outcome: AuditOutcome;
  errorCode: string | null;
  statusCode: number | null;
}
