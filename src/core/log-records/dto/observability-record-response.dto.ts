import { UserRole } from 'src/core/auth/auth.types';
import { LogLevel } from 'src/core/observability/enums';
import {
  LogActorType,
  LogRecordType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

/**
 * Registro técnico como o administrador o vê.
 *
 * Stack e metadata ficam de fora da listagem por decisão de exposição; a
 * origem no código aparece só como arquivo relativo e linha.
 */
export class ObservabilityRecordResponseDto {
  schemaVersion!: string;
  eventId!: string;
  recordType!: LogRecordType.Observability;
  environment!: string;
  service!: string;
  occurredAt!: string;
  requestId!: string | null;
  sourceType!: LogSourceType;
  actorType!: LogActorType;
  actorId!: string | null;
  actorRole!: UserRole | null;
  level!: LogLevel;
  context!: string;
  moduleName!: string;
  operation!: string | null;
  message!: string;
  errorName!: string | null;
  errorCode!: string | null;
  errorMessage!: string | null;
  errorFingerprint!: string | null;
  sourceFile!: string | null;
  sourceLine!: number | null;
  httpMethod!: string | null;
  routeTemplate!: string | null;
  statusCode!: number | null;
  durationMs!: number | null;
  providerName!: string | null;
  jobName!: string | null;
}
