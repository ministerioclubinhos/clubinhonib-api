import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { AI_QUEUE } from './constants';
import { AiQueueFailure, AiQueueFeature, AiQueueMethod } from './enums';
import {
  AiQueueCompletion,
  AiQueueConfig,
  AiQueueRequest,
  AiQueueRequestOptions,
  AiQueueResponse,
  AiQueueResult,
} from './types';
import {
  aiBodyBytes,
  aiQueueEndpoint,
  aiQueueErrorSummary,
  queueInteger,
  redisConnection,
  restoreAiError,
  serializeAiBody,
} from './utils';
import { AiQueueException } from './ai-queue.exception';
import { AiRequestProcessor } from './ai-request.processor';
import { waitForAiJob } from './wait-for-ai-job.utils';

@Injectable()
export class AiRequestQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiRequestQueueService.name);
  private readonly settings: AiQueueConfig;
  /** Identifies this process to workers; see the orphan check in the processor. */
  private readonly producerId = randomUUID();
  private redis?: Redis;
  private workerRedis?: Redis;
  private queue?: Queue<AiQueueRequest, AiQueueCompletion>;
  private events?: QueueEvents;
  private worker?: Worker<AiQueueRequest, AiQueueCompletion>;
  private ready = false;
  private starting = false;
  private closed = false;
  private cleanup?: NodeJS.Timeout;
  private heartbeat?: NodeJS.Timeout;
  private restart?: NodeJS.Timeout;

  constructor(
    config: ConfigService,
    private readonly processor: AiRequestProcessor,
  ) {
    const prefix = config.get<string>('AI_QUEUE_PREFIX') || AI_QUEUE.prefix;
    if (!/^[a-zA-Z0-9_-]+$/.test(prefix))
      throw new Error('AI_QUEUE_PREFIX inválido.');
    this.settings = {
      connection: redisConnection(
        config.get<string>('REDIS_URL') || AI_QUEUE.redisUrl,
      ),
      prefix,
      concurrency: queueInteger(
        config.get('AI_QUEUE_CONCURRENCY'),
        AI_QUEUE.concurrency,
        AI_QUEUE.maxConcurrency,
        'AI_QUEUE_CONCURRENCY',
      ),
      waitMs: queueInteger(
        config.get('AI_QUEUE_WAIT_MS'),
        AI_QUEUE.waitMs,
        AI_QUEUE.maxWaitMs,
        'AI_QUEUE_WAIT_MS',
      ),
    };
  }

  /**
   * Never blocks the API boot: without Redis only the AI routes degrade with
   * a queue-unavailable error while this service keeps trying to come up.
   */
  async onModuleInit(): Promise<void> {
    await this.start();
  }

  private async start(): Promise<void> {
    if (this.starting || this.ready || this.closed) return;
    this.starting = true;
    try {
      await this.connect();
      this.ready = true;
      this.logger.log(
        `Fila de IA pronta; concorrência global: ${this.settings.concurrency}.`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Fila de IA indisponível (${aiQueueErrorSummary(error)}); as rotas de IA ficam degradadas e uma nova tentativa ocorrerá em ${AI_QUEUE.startRetryMs}ms.`,
      );
      await this.teardown();
      if (!this.closed) {
        this.restart = setTimeout(
          () => void this.start(),
          AI_QUEUE.startRetryMs,
        );
        this.restart.unref();
      }
    } finally {
      this.starting = false;
    }
  }

  private async connect(): Promise<void> {
    const { connection, prefix, concurrency } = this.settings;
    const producerConnection = {
      ...connection,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: AI_QUEUE.connectionMs,
    };
    this.redis = new Redis({ ...producerConnection, lazyConnect: true });
    this.redis.on('error', (error: unknown) =>
      this.logConnectionError('producer', error),
    );
    // Result writes carry image payloads: a dedicated connection with a
    // generous timeout keeps a slow SET from discarding a paid answer.
    this.workerRedis = new Redis({
      ...connection,
      commandTimeout: AI_QUEUE.workerCommandMs,
      lazyConnect: true,
    });
    this.workerRedis.on('error', (error: unknown) =>
      this.logConnectionError('worker-store', error),
    );
    await Promise.all([this.redis.connect(), this.workerRedis.connect()]);
    this.queue = new Queue<AiQueueRequest, AiQueueCompletion>(AI_QUEUE.name, {
      connection: producerConnection,
      prefix,
      streams: { events: { maxLen: AI_QUEUE.maxEventStreamLength } },
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: {
          age: AI_QUEUE.resultTtlMs / 1000,
          count: AI_QUEUE.retainedJobCount,
        },
        removeOnFail: {
          age: AI_QUEUE.resultTtlMs / 1000,
          count: AI_QUEUE.retainedJobCount,
        },
      },
    });
    this.events = new QueueEvents(AI_QUEUE.name, {
      connection: { ...connection, maxRetriesPerRequest: null },
      prefix,
    });
    const workerRedis = this.workerRedis;
    this.worker = new Worker<AiQueueRequest, AiQueueCompletion>(
      AI_QUEUE.name,
      (job) => this.processor.process(job, workerRedis, prefix),
      {
        connection: { ...connection, maxRetriesPerRequest: null },
        prefix,
        concurrency,
        autorun: false,
        lockDuration: AI_QUEUE.lockMs,
        stalledInterval: AI_QUEUE.stalledIntervalMs,
        maxStalledCount: 1,
      },
    );
    this.queue.on('error', (error: unknown) =>
      this.logConnectionError('queue', error),
    );
    // Each waiting request registers one closing listener, removed on settlement.
    this.queue.setMaxListeners(0);
    this.events.on('error', (error: unknown) =>
      this.logConnectionError('events', error),
    );
    this.worker.on('error', (error: unknown) =>
      this.logConnectionError('worker', error),
    );
    this.worker.on('failed', (job, error) =>
      this.logger.warn(
        `[ai-queue] job=${job?.id ?? 'desconhecido'} outcome=failed reason=${aiQueueErrorSummary(error)}`,
      ),
    );
    this.worker.on('stalled', (jobId) =>
      this.logger.warn(`[ai-queue] job=${jobId} outcome=stalled`),
    );
    await Promise.all([
      this.queue.waitUntilReady(),
      this.events.waitUntilReady(),
      this.worker.waitUntilReady(),
    ]);
    await this.queue.setGlobalConcurrency(concurrency);
    await this.beat();
    void this.worker
      .run()
      .catch((error: unknown) => this.logConnectionError('worker', error));
    this.heartbeat = setInterval(
      () =>
        void this.beat().catch((error: unknown) =>
          this.logConnectionError('heartbeat', error),
        ),
      AI_QUEUE.producerHeartbeatMs,
    );
    this.heartbeat.unref();
    this.cleanup = setInterval(
      () =>
        void this.clean().catch((error: unknown) =>
          this.logConnectionError('cleanup', error),
        ),
      AI_QUEUE.cleanupIntervalMs,
    );
    this.cleanup.unref();
  }

  private producerKey(): string {
    return `${this.settings.prefix}:llm-producer:${this.producerId}`;
  }

  private async beat(): Promise<void> {
    await this.redis?.set(
      this.producerKey(),
      '1',
      'PX',
      AI_QUEUE.producerTtlMs,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    if (this.restart) clearTimeout(this.restart);
    // Jobs still queued by this process are dropped by any worker instead of
    // being billed for a caller that no longer exists.
    await this.redis?.del(this.producerKey()).catch(() => undefined);
    await this.teardown();
  }

  private async teardown(): Promise<void> {
    this.ready = false;
    if (this.cleanup) clearInterval(this.cleanup);
    if (this.heartbeat) clearInterval(this.heartbeat);
    // Force close preserves active jobs for stalled recovery after process exit.
    await Promise.allSettled([
      this.worker?.close(true),
      this.events?.close(),
      this.queue?.close(),
    ]);
    this.redis?.disconnect();
    this.workerRedis?.disconnect();
    this.worker = undefined;
    this.events = undefined;
    this.queue = undefined;
    this.redis = undefined;
    this.workerRedis = undefined;
  }

  private available(): boolean {
    return Boolean(
      this.ready && this.queue && this.events && this.redis?.status === 'ready',
    );
  }

  /** A short Redis blip should not fail a stage that already paid for images. */
  private async waitUntilAvailable(): Promise<void> {
    const deadline = Date.now() + AI_QUEUE.reconnectWaitMs;
    while (!this.available() && !this.closed && Date.now() < deadline)
      await new Promise<void>((resolve) =>
        setTimeout(resolve, AI_QUEUE.reconnectPollMs),
      );
  }

  post<T>(
    url: string,
    body: object | FormData,
    options: AiQueueRequestOptions,
  ): Promise<AiQueueResponse<T>> {
    return this.submit<T>(AiQueueMethod.POST, url, body, options);
  }

  get<T>(
    url: string,
    options: AiQueueRequestOptions,
  ): Promise<AiQueueResponse<T>> {
    return this.submit<T>(AiQueueMethod.GET, url, {}, options);
  }

  private async submit<T>(
    method: AiQueueMethod,
    url: string,
    body: object | FormData,
    options: AiQueueRequestOptions,
  ): Promise<AiQueueResponse<T>> {
    if (!this.available()) await this.waitUntilAvailable();
    const { queue, events, redis } = this;
    if (!this.available() || !queue || !events || !redis)
      throw new AiQueueException(AiQueueFailure.UNAVAILABLE);
    const endpoint = aiQueueEndpoint(url, method);
    const timeoutMs = queueInteger(
      options.timeout,
      AI_QUEUE.defaultRequestMs,
      AI_QUEUE.maxRequestMs,
      'timeout',
    );
    const waitMs = Math.min(
      queueInteger(
        options.waitMs,
        this.settings.waitMs,
        AI_QUEUE.maxWaitMs,
        'waitMs',
      ),
      this.settings.waitMs,
    );
    const serializedBody = await serializeAiBody(body);
    if (aiBodyBytes(serializedBody) > AI_QUEUE.maxPayloadBytes)
      throw new AiQueueException(AiQueueFailure.INVALID_REQUEST);
    const data: AiQueueRequest = {
      ...endpoint,
      producerId: this.producerId,
      method,
      feature: options.feature,
      body: serializedBody,
      timeoutMs,
      expiresAt: Date.now() + waitMs + timeoutMs,
      maxContentLength: queueInteger(
        options.maxContentLength,
        AI_QUEUE.maxResponseBytes,
        AI_QUEUE.maxResponseBytes,
        'maxContentLength',
      ),
    };
    const jobId = randomUUID();
    let job: Job<AiQueueRequest, AiQueueCompletion> | undefined;
    let result: AiQueueResult;
    try {
      job = await queue.add(AI_QUEUE.jobName, data, {
        jobId,
        // Interactive lookups must not wait behind minutes of image generation.
        priority:
          options.feature === AiQueueFeature.PROVIDER_SETTINGS
            ? AI_QUEUE.interactivePriority
            : AI_QUEUE.defaultPriority,
      });
      const completion = await waitForAiJob(
        job,
        queue,
        events,
        waitMs + timeoutMs + AI_QUEUE.terminalGraceMs,
      );
      const serialized = await redis.getdel(completion.resultKey);
      if (!serialized)
        throw new AiQueueException(AiQueueFailure.RESULT_EXPIRED);
      result = JSON.parse(serialized) as AiQueueResult;
    } catch (error: unknown) {
      await this.cancel(jobId, job);
      if (error instanceof AiQueueException) throw error;
      if (
        error instanceof Error &&
        [AiQueueFailure.EXPIRED, AiQueueFailure.RESULT_EXPIRED].includes(
          error.message as AiQueueFailure,
        )
      )
        throw new AiQueueException(AiQueueFailure.EXPIRED);
      throw new AiQueueException(AiQueueFailure.UNAVAILABLE);
    }
    await job
      .remove()
      .catch((error: unknown) => this.logConnectionError('remove', error));
    if (!result.success)
      throw result.error.queueFailure
        ? new AiQueueException(result.error.queueFailure)
        : restoreAiError(result.error);
    return result.response as AiQueueResponse<T>;
  }

  private async cancel(
    jobId: string,
    job?: Job<AiQueueRequest, AiQueueCompletion>,
  ): Promise<void> {
    // Includes ambiguous queue.add failures: a timed-out Redis write may have succeeded.
    await this.redis
      ?.set(
        `${this.settings.prefix}:llm-cancel:${jobId}`,
        '1',
        'PX',
        this.settings.waitMs + AI_QUEUE.maxRequestMs + AI_QUEUE.terminalGraceMs,
      )
      .catch(() => undefined);
    await job?.remove().catch(() => undefined);
  }

  private async clean(): Promise<void> {
    await this.queue?.clean(
      AI_QUEUE.resultTtlMs,
      AI_QUEUE.retainedJobCount,
      'completed',
    );
    await this.queue?.clean(
      AI_QUEUE.resultTtlMs,
      AI_QUEUE.retainedJobCount,
      'failed',
    );
  }

  private logConnectionError(source: string, error: unknown): void {
    this.logger.warn(
      `Falha na conexão da fila de IA com Redis (${source}): ${aiQueueErrorSummary(error)}`,
    );
  }
}
