import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';

import { ComponentsRegistry } from 'src/core/request-context/discovery/components.registry';
import { RequestContextService } from 'src/core/request-context/request-context.service';
import {
  DEFAULT_DELIVERY_QUEUE_OPTIONS,
  LOG_STORAGE_CLOCK,
  LOG_STORAGE_CONFIG,
} from 'src/shared/providers/log-storage/constants';
import { LogDeliveryQueue } from 'src/shared/providers/log-storage/delivery/log-delivery-queue';
import { ObservabilityStoragePort } from 'src/shared/providers/log-storage/ports/log-storage.port';
import {
  Clock,
  DeliveryQueueStats,
  LogStorageConfig,
} from 'src/shared/providers/log-storage/types';
import { emergencyWrite } from 'src/shared/providers/log-storage/utils';

import { OBSERVABILITY_QUEUE_NAME, PERSISTED_LOG_LEVELS } from '../constants';
import { ObservabilityRecord, TechnicalLogInput } from '../types';
import { buildObservabilityRecord } from '../utils/observability-record.utils';

/**
 * Transforma um problema técnico em registro persistido.
 *
 * Único caminho de escrita do fluxo de observabilidade: o logger estruturado,
 * os listeners de processo e os jobs passam por aqui. Nunca usa o `Logger` do
 * Nest — seria pedir a si mesmo para persistir a própria falha.
 */
@Injectable()
export class WriteTechnicalLogService implements OnApplicationShutdown {
  private readonly queue: LogDeliveryQueue;

  constructor(
    private readonly storage: ObservabilityStoragePort,
    @Inject(LOG_STORAGE_CONFIG) private readonly config: LogStorageConfig,
    @Inject(LOG_STORAGE_CLOCK) private readonly clock: Clock,
    private readonly requestContext: RequestContextService,
    private readonly registry: ComponentsRegistry,
  ) {
    this.queue = new LogDeliveryQueue(
      OBSERVABILITY_QUEUE_NAME,
      (record) => this.storage.write(record),
      DEFAULT_DELIVERY_QUEUE_OPTIONS,
      emergencyWrite,
    );
  }

  /** Persiste se o nível for dos que vão ao storage; devolve o item montado. */
  report(input: TechnicalLogInput): ObservabilityRecord | null {
    if (!PERSISTED_LOG_LEVELS.has(input.level)) return null;
    const record = this.build(input);
    this.queue.enqueue(record);
    return record;
  }

  /** Monta sem enfileirar; para o filtro e os testes inspecionarem. */
  build(input: TechnicalLogInput): ObservabilityRecord {
    return buildObservabilityRecord(input, {
      environment: this.config.environment,
      ttlDays: this.config.observability.ttlDays,
      now: this.clock(),
      moduleName: this.registry.moduleOf(input.context),
      requestContext: this.requestContext.get(),
    });
  }

  stats(): DeliveryQueueStats {
    return this.queue.snapshot();
  }

  /** Espera o pendente ser escrito, mantendo a fila aberta. */
  async settle(): Promise<void> {
    await this.queue.settle();
  }

  /** Espera a fila esvaziar (até o limite) e a fecha; usado no encerramento. */
  async flush(): Promise<void> {
    await this.queue.drain();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush();
  }
}
