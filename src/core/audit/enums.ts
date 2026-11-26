/** Fronteira em que a ação aconteceu. */
export enum AuditActionType {
  HttpRequest = 'http_request',
  ScheduledJob = 'scheduled_job',
  SystemOperation = 'system_operation',
}

/** Como a ação terminou (D-003: tentativas e falhas também são auditadas). */
export enum AuditOutcome {
  Succeeded = 'succeeded',
  Failed = 'failed',
  Denied = 'denied',
  Rejected = 'rejected',
  NotFound = 'not_found',
}

export enum AuditHttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}
