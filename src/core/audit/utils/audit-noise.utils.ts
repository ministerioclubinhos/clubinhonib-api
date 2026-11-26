import {
  AUDIT_SILENT_SUCCESS_HANDLERS,
  AUDIT_SILENT_SUCCESS_JOBS,
} from '../constants';
import { AuditOutcome } from '../enums';
import { AuditRecord } from '../types';

/**
 * `true` quando o evento é ruído e não deve ir ao storage.
 *
 * Só sucesso pode ser ruído: qualquer outro resultado é sempre gravado.
 */
export function isAuditNoise(
  record: Pick<
    AuditRecord,
    'outcome' | 'jobName' | 'controllerName' | 'handlerName'
  >,
): boolean {
  if (record.outcome !== AuditOutcome.Succeeded) return false;
  if (record.jobName && AUDIT_SILENT_SUCCESS_JOBS.has(record.jobName))
    return true;
  return (
    Boolean(record.controllerName && record.handlerName) &&
    AUDIT_SILENT_SUCCESS_HANDLERS.has(
      `${record.controllerName}.${record.handlerName}`,
    )
  );
}
