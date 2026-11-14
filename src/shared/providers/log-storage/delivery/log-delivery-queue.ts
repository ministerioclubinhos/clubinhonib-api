import {
  DeliveryQueueOptions,
  DeliveryQueueStats,
  EmergencySink,
  LogRecord,
  LogWriteError,
  LogWriteFailureKind,
} from '../types';
import { describeError } from '../utils';

type Writer = (record: LogRecord) => Promise<void>;

/**
 * Fila limitada e assíncrona entre quem gera eventos e o storage.
 *
 * Garantia escolhida: *best effort*. A requisição nunca espera o storage nem
 * falha por causa dele; em troca, com a fila cheia o evento mais novo é
 * descartado e contado. Erros transitórios recebem uma nova tentativa; erros
 * permanentes (item grande, condição violada) não.
 */
export class LogDeliveryQueue {
  private readonly pending: LogRecord[] = [];
  private readonly stats: DeliveryQueueStats = {
    enqueued: 0,
    written: 0,
    dropped: 0,
    failed: 0,
    pending: 0,
  };
  private draining: Promise<void> | null = null;
  private closed = false;

  constructor(
    private readonly name: string,
    private readonly writer: Writer,
    private readonly options: DeliveryQueueOptions,
    private readonly emergency: EmergencySink,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((done) => setTimeout(done, ms)),
  ) {}

  /** Aceita o item e devolve na hora; a escrita segue em segundo plano. */
  enqueue(record: LogRecord): boolean {
    if (this.closed) {
      this.stats.dropped += 1;
      return false;
    }
    if (this.pending.length >= this.options.maxQueueSize) {
      this.stats.dropped += 1;
      this.emergency(this.name, 'fila cheia: evento descartado', {
        eventId: record.eventId,
        dropped: this.stats.dropped,
      });
      return false;
    }
    this.pending.push(record);
    this.stats.enqueued += 1;
    this.stats.pending = this.pending.length;
    this.kick();
    return true;
  }

  snapshot(): DeliveryQueueStats {
    return { ...this.stats, pending: this.pending.length };
  }

  /** Espera o que está na fila ser escrito, sem fechá-la. */
  async settle(): Promise<void> {
    while (this.draining) await this.draining;
  }

  /** Espera esvaziar, até o limite; o que sobrar depois disso é contado. */
  async drain(): Promise<void> {
    this.closed = true;
    if (!this.draining) return;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((done) => {
      timer = setTimeout(done, this.options.drainTimeoutMs);
    });
    await Promise.race([this.draining, timeout]);
    if (timer) clearTimeout(timer);
    if (this.pending.length > 0) {
      this.stats.dropped += this.pending.length;
      this.emergency(this.name, 'encerrando com eventos pendentes', {
        pending: this.pending.length,
      });
      this.pending.length = 0;
    }
  }

  private kick(): void {
    if (this.draining) return;
    this.draining = this.loop().finally(() => {
      this.draining = null;
    });
  }

  private async loop(): Promise<void> {
    while (this.pending.length > 0) {
      const record = this.pending[0];
      await this.deliver(record);
      this.pending.shift();
      this.stats.pending = this.pending.length;
    }
  }

  private async deliver(record: LogRecord): Promise<void> {
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      try {
        await this.withTimeout(this.writer(record));
        this.stats.written += 1;
        return;
      } catch (error: unknown) {
        const transient =
          error instanceof LogWriteError
            ? error.kind === LogWriteFailureKind.Transient
            : true;
        if (!transient || attempt === this.options.maxAttempts) {
          this.stats.failed += 1;
          this.emergency(this.name, 'falha ao persistir evento', {
            eventId: record.eventId,
            attempt,
            error: describeError(error),
          });
          return;
        }
        await this.sleep(this.options.retryDelayMs);
      }
    }
  }

  private async withTimeout(write: Promise<void>): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new LogWriteError(
              `escrita excedeu ${this.options.writeTimeoutMs}ms`,
              LogWriteFailureKind.Transient,
            ),
          ),
        this.options.writeTimeoutMs,
      );
    });
    try {
      await Promise.race([write, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
