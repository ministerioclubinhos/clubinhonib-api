import { AuditActionType, AuditOutcome } from 'src/core/audit/enums';
import { UserRole } from 'src/core/auth/auth.types';
import {
  LogActorType,
  LogRecordType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

/** Evento de auditoria como o administrador o vê. */
export class AuditRecordResponseDto {
  schemaVersion!: string;
  eventId!: string;
  recordType!: LogRecordType.Audit;
  environment!: string;
  service!: string;
  occurredAt!: string;
  requestId!: string | null;
  sourceType!: LogSourceType;
  actorType!: LogActorType;
  actorId!: string | null;
  actorRole!: UserRole | null;
  actionType!: AuditActionType;
  actionName!: string;
  moduleName!: string | null;
  controllerName!: string | null;
  handlerName!: string | null;
  resourceType!: string | null;
  resourceId!: string | null;
  outcome!: AuditOutcome;
  httpMethod!: string | null;
  routeTemplate!: string | null;
  statusCode!: number | null;
  durationMs!: number;
  errorCode!: string | null;
  occurrenceCount!: number;
  jobName!: string | null;
}
