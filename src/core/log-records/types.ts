import { AUDIT_FILTER_FIELDS, OBSERVABILITY_FILTER_FIELDS } from './constants';

export type ObservabilityFilterField =
  (typeof OBSERVABILITY_FILTER_FIELDS)[number];
export type AuditFilterField = (typeof AUDIT_FILTER_FIELDS)[number];

/** Intervalo validado, pronto para o storage. */
export interface ValidatedRange {
  from: Date;
  to: Date;
}
