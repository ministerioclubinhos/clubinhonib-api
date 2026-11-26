import { createHash } from 'node:crypto';

import { primitiveToString } from 'src/shared/providers/log-storage/utils';

import {
  AUDIT_FINGERPRINT_FIELDS,
  AUDIT_FINGERPRINT_LENGTH,
} from '../constants';
import { AuditRecord } from '../types';

/**
 * Hash estável dos campos allowlisted de um evento de auditoria.
 *
 * Representação canônica (chaves em ordem fixa) e hash criptográfico; nunca
 * entra body, segredo ou o `requestId` — este muda a cada request e anularia
 * a janela.
 */
export function auditFingerprint(record: AuditRecord): string {
  const canonical = AUDIT_FINGERPRINT_FIELDS.map((field) => {
    const value = record[field];
    return primitiveToString(value);
  }).join('|');
  return createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, AUDIT_FINGERPRINT_LENGTH);
}
