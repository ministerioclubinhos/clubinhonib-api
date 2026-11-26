import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';

import { RequestContextService } from 'src/core/request-context/request-context.service';
import { RequestExecutionContext } from 'src/core/request-context/types';
import {
  DEFAULT_DELIVERY_QUEUE_OPTIONS,
  LOG_STORAGE_CLOCK,
  LOG_STORAGE_CONFIG,
} from 'src/shared/providers/log-storage/constants';
import { LogDeliveryQueue } from 'src/shared/providers/log-storage/delivery/log-delivery-queue';
import { AuditStoragePort } from 'src/shared/providers/log-storage/ports/log-storage.port';
import {
  Clock,
  DeliveryQueueStats,
  LogStorageConfig,
} from 'src/shared/providers/log-storage/types';
import {
  describeError,
  emergencyWrite,
} from 'src/shared/providers/log-storage/utils';

import { AUDIT_QUEUE_NAME } from '../constants';
import {
  AuditRecord,
  BoundaryDescriptor,
  BoundaryOutcomeInput,
  HttpOutcomeInput,
} from '../types';
import {
  buildBoundaryAuditRecord,
  buildHttpAuditRecord,
  buildRepeatRecord,
} from '../utils/audit-record.utils';
import { isAuditedHttpMethod } from '../utils/audit-event.utils';
import { isAuditNoise } from '../utils/audit-noise.utils';
import { AuditDeduplicationService } from './audit-deduplication.service';

/**
 * Único ponto de escrita do fluxo de auditoria.
 *
 * Quem chama é o interceptor (sucesso), o filtro (falha) e o boundary de jobs;
 * controllers, services e repositories não conhecem esta classe. A gravação é
 * idempotente por execução: a primeira chamada ganha, as demais são ignoradas.
 */
@Injectable()
export class WriteAuditEventService implements OnApplicationShutdown {
  private readonly queue: LogDeliveryQueue;
  private inFlight: Promise<void>[] = [];

  constructor(
    private readonly storage: AuditStoragePort,
    @Inject(LOG_STORAGE_CONFIG) private readonly config: LogStorageConfig,
    @Inject(LOG_STORAGE_CLOCK) private readonly clock: Clock,
    private readonly requestContext: RequestContextService,
    private readonly dedup: AuditDeduplicationService,
  ) {
    this.queue = new LogDeliveryQueue(
      AUDIT_QUEUE_NAME,
      (record) => this.storage.write(record),
      DEFAULT_DELIVERY_QUEUE_OPTIONS,
      emergencyWrite,
    );
  }

  /**
   * Fecha a ação HTTP em curso; devolve o evento ou `null` quando não há o que
   * gravar: leitura (só mutações são auditadas), ação já gravada ou ruído
   * (`isAuditNoise`).
   */
  recordHttpOutcome(outcome: HttpOutcomeInput): AuditRecord | null {
    const ctx = this.requestContext.get();
    if (!ctx || !isAuditedHttpMethod(ctx.httpMethod)) return null;
    if (!this.requestContext.claimAuditWrite()) return null;
    const record = buildHttpAuditRecord(ctx, outcome, this.environment());
    if (isAuditNoise(record)) return null;
    this.track(this.persist(record));
    return record;
  }

  /** Fecha uma ação fora do HTTP, no contexto aberto pelo boundary. */
  recordBoundaryOutcome(
    ctx: RequestExecutionContext,
    descriptor: BoundaryDescriptor,
    outcome: BoundaryOutcomeInput,
  ): AuditRecord | null {
    if (ctx.auditWritten) return null;
    ctx.auditWritten = true;
    const record = buildBoundaryAuditRecord(
      ctx,
      descriptor,
      outcome,
      this.environment(),
    );
    if (isAuditNoise(record)) return null;
    this.track(this.persist(record));
    return record;
  }

  stats(): DeliveryQueueStats {
    return this.queue.snapshot();
  }

  /** Espera o pendente (dedup e escrita) terminar, mantendo a fila aberta. */
  async settle(): Promise<void> {
    await Promise.allSettled(this.inFlight);
    await this.queue.settle();
  }

  /** Espera esvaziar e fecha a fila; usado no encerramento. */
  async flush(): Promise<void> {
    await Promise.allSettled(this.inFlight);
    await this.queue.drain();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush();
  }

  private environment() {
    return {
      environment: this.config.environment,
      ttlDays: this.config.audit.ttlDays,
      now: this.clock(),
    };
  }

  private async persist(record: AuditRecord): Promise<void> {
    try {
      const claim = await this.dedup.evaluate(record);
      if (claim?.duplicateOf) {
        this.queue.enqueue(
          buildRepeatRecord(record, claim.fingerprint, claim.duplicateOf),
        );
        return;
      }
      this.queue.enqueue({
        ...record,
        dedupFingerprint: claim?.fingerprint ?? null,
      });
    } catch (error: unknown) {
      // Dedup indisponível não pode custar o evento: grava sem fingerprint.
      emergencyWrite(AUDIT_QUEUE_NAME, 'dedup falhou; gravando sem janela', {
        error: describeError(error),
      });
      this.queue.enqueue(record);
    }
  }

  private track(promise: Promise<void>): void {
    const tracked = promise.finally(() => {
      this.inFlight = this.inFlight.filter((item) => item !== tracked);
    });
    this.inFlight.push(tracked);
  }
}
