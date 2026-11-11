import { randomUUID } from 'node:crypto';

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
import {
  emergencyWrite,
  expiresAtEpochSeconds,
} from 'src/shared/providers/log-storage/utils';

import {
  ECHO_LOG_CONTEXTS,
  OBSERVABILITY_QUEUE_NAME,
  PERSISTED_LOG_LEVELS,
  REPEAT_SUMMARY_PREFIX,
  REPEAT_WINDOW_MS,
} from '../constants';
import { LogLevel } from '../enums';
import {
  ClientErrorInput,
  ClosedRepeatWindow,
  ObservabilityRecord,
  TechnicalLogInput,
} from '../types';
import { buildObservabilityRecord } from '../utils/observability-record.utils';
import {
  isPersistedClientError,
  TechnicalLogRepeatWindow,
} from '../utils/technical-log-noise.utils';

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
  private readonly repeats = new TechnicalLogRepeatWindow(REPEAT_WINDOW_MS);
  private readonly sweeper: NodeJS.Timeout;

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
    // Fecha as janelas mesmo quando o erro para de acontecer.
    this.sweeper = setInterval(() => this.sweep(), REPEAT_WINDOW_MS);
    this.sweeper.unref();
  }

  /**
   * Persiste se o nível for dos que vão ao storage e o registro não for ruído;
   * devolve o item gravado ou `null` (nível fora, eco ou repetição contada).
   */
  report(input: TechnicalLogInput): ObservabilityRecord | null {
    if (!PERSISTED_LOG_LEVELS.has(input.level)) return null;
    return this.admit(input);
  }

  /**
   * Resposta 4xx vira registro `warn`, salvo o ruído descrito em `constants`
   * (401 e 404 de rota inexistente).
   */
  reportClientError(input: ClientErrorInput): ObservabilityRecord | null {
    const handlerName = this.requestContext.get()?.handlerName;
    if (!isPersistedClientError(input.statusCode, handlerName)) return null;
    return this.admit({
      level: LogLevel.Warn,
      context: input.context,
      message: input.message,
      error: input.error,
    });
  }

  private admit(input: TechnicalLogInput): ObservabilityRecord | null {
    const ctx = this.requestContext.get();
    // O filtro global só repete o que um serviço desta execução já registrou.
    if (
      ctx?.technicalLogWritten &&
      input.context &&
      ECHO_LOG_CONTEXTS.has(input.context)
    )
      return null;
    const record = this.build(input);
    if (ctx) ctx.technicalLogWritten = true;
    this.sweep();
    // `fatal` nunca é agregado: cada um importa.
    if (
      input.level !== LogLevel.Fatal &&
      !this.repeats.admit(record, this.clock())
    )
      return null;
    this.queue.enqueue(record);
    return record;
  }

  /** Grava o resumo das janelas encerradas que tiveram repetição. */
  private sweep(all = false): void {
    for (const closed of this.repeats.collect(this.clock(), all))
      this.queue.enqueue(this.summaryOf(closed));
  }

  private summaryOf(closed: ClosedRepeatWindow): ObservabilityRecord {
    return {
      ...closed.first,
      eventId: randomUUID(),
      occurredAt: closed.lastOccurredAt.toISOString(),
      expiresAtEpochSeconds: expiresAtEpochSeconds(
        closed.lastOccurredAt,
        this.config.observability.ttlDays,
      ),
      occurrenceCount: closed.repeats,
      message: `${REPEAT_SUMMARY_PREFIX(closed.repeats, REPEAT_WINDOW_MS / 1000)}${closed.first.message}`,
    };
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
    clearInterval(this.sweeper);
    this.sweep(true);
    await this.queue.drain();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush();
  }
}
