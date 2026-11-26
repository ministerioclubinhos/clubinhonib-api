import { Inject, Injectable } from '@nestjs/common';

import { LOG_STORAGE_CONFIG } from 'src/shared/providers/log-storage/constants';
import { AuditStoragePort } from 'src/shared/providers/log-storage/ports/log-storage.port';
import {
  DedupClaim,
  LogStorageConfig,
} from 'src/shared/providers/log-storage/types';

import { AuditRecord } from '../types';
import { auditFingerprint } from '../utils/audit-fingerprint.utils';

/**
 * Janela de desduplicação (`AUDIT_DEDUP_SECONDS`).
 *
 * Estratégia escolhida (D-004): agregação. O primeiro evento de um
 * fingerprint abre a janela e é gravado inteiro; os iguais dentro dela viram
 * repetição apontando para ele. Nenhuma ação deixa de ser registrada; o que se
 * economiza é o item completo. Janela `0` desliga tudo.
 */
@Injectable()
export class AuditDeduplicationService {
  constructor(
    private readonly storage: AuditStoragePort,
    @Inject(LOG_STORAGE_CONFIG) private readonly config: LogStorageConfig,
  ) {}

  get windowSeconds(): number {
    return this.config.audit.dedupSeconds;
  }

  async evaluate(record: AuditRecord): Promise<DedupClaim | null> {
    if (this.windowSeconds <= 0) return null;
    const fingerprint = auditFingerprint(record);
    return this.storage.claimDedup({
      fingerprint,
      eventId: record.eventId,
      occurredAt: record.occurredAt,
      windowSeconds: this.windowSeconds,
      expiresAtEpochSeconds: record.expiresAtEpochSeconds,
    });
  }
}
