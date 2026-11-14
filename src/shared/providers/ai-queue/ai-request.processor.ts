import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { AiProviderTransportProvider } from './ai-provider-transport.provider';
import {
  AiQueueCompletion,
  AiQueueJobLog,
  AiQueueRequest,
  AiQueueResult,
} from './types';
import { AiQueueBodyKind, AiQueueFailure } from './enums';
import { AI_QUEUE } from './constants';
import { aiQueueErrorSummary, aiQueuePath, serializeAiError } from './utils';

@Injectable()
export class AiRequestProcessor {
  private readonly logger = new Logger(AiRequestProcessor.name);

  constructor(private readonly transport: AiProviderTransportProvider) {}

  async process(
    job: Job<AiQueueRequest>,
    redis: Redis,
    prefix: string,
  ): Promise<AiQueueCompletion> {
    const resultKey = `${prefix}:llm-result:${job.id}`;
    // A stalled worker can resume after persisting a result: don't bill again.
    if (await redis.exists(resultKey)) return { resultKey };
    if (job.data.resultStored) throw new Error(AiQueueFailure.RESULT_EXPIRED);
    if (await redis.exists(`${prefix}:llm-cancel:${job.id}`))
      return this.discard(job, AiQueueFailure.CANCELLED);
    if (job.data.expiresAt <= Date.now())
      return this.discard(job, AiQueueFailure.EXPIRED);
    // The producer that awaits this job died (deploy/crash): a paid call
    // would produce a result nobody reads, and the stage is retried anyway.
    if (
      job.data.producerId &&
      !(await redis.exists(`${prefix}:llm-producer:${job.data.producerId}`))
    )
      return this.discard(job, AiQueueFailure.ORPHANED);
    const startedAt = Date.now();
    let result: AiQueueResult;
    try {
      result = {
        success: true,
        response: await this.transport.execute(job.data),
      };
    } catch (error: unknown) {
      result = { success: false, error: serializeAiError(error) };
    }
    this.log(job, result, Date.now() - startedAt);
    // BullMQ's event stream receives only the result key, never image bytes.
    await this.persist(redis, resultKey, JSON.stringify(result), job);
    await this.clearPayload(job, true);
    return { resultKey };
  }

  /** Retries only the Redis write: the provider answer was already paid for. */
  private async persist(
    redis: Redis,
    resultKey: string,
    serialized: string,
    job: Job<AiQueueRequest>,
  ): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await redis.set(resultKey, serialized, 'PX', AI_QUEUE.resultTtlMs);
        return;
      } catch (error: unknown) {
        this.logger.warn(
          `[ai-queue] job=${job.id} phase=persist attempt=${attempt}/${AI_QUEUE.resultWriteAttempts} error=${aiQueueErrorSummary(error)}`,
        );
        if (attempt >= AI_QUEUE.resultWriteAttempts) throw error;
        await new Promise<void>((resolve) =>
          setTimeout(
            resolve,
            AI_QUEUE.resultWriteBackoffMs * 2 ** (attempt - 1),
          ),
        );
      }
    }
  }

  private async discard(
    job: Job<AiQueueRequest>,
    reason: AiQueueFailure,
  ): Promise<never> {
    await this.clearPayload(job);
    this.logger.warn(
      `[ai-queue] job=${job.id} feature=${job.data.feature} provider=${job.data.provider} outcome=${reason}`,
    );
    throw new Error(reason);
  }

  /** Identifiers and timings only: never prompts, bodies, headers or keys. */
  private log(
    job: Job<AiQueueRequest>,
    result: AiQueueResult,
    ms: number,
  ): void {
    const entry: AiQueueJobLog = {
      jobId: String(job.id),
      feature: job.data.feature,
      provider: job.data.provider,
      path: aiQueuePath(job.data.url),
      outcome: result.success
        ? 'ok'
        : (result.error.queueFailure ?? 'provider_error'),
      status: result.success ? result.response.status : result.error.status,
      providerCode: result.success
        ? undefined
        : (result.error.providerCode ??
          result.error.providerStatus ??
          result.error.type ??
          result.error.code),
      requestId: (result.success
        ? result.response.headers
        : result.error.headers)['x-request-id'],
      ms,
    };
    const line = `[ai-queue] ${Object.entries(entry)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ')}`;
    if (result.success) this.logger.log(line);
    else this.logger.warn(line);
  }

  private async clearPayload(
    job: Job<AiQueueRequest>,
    resultStored = false,
  ): Promise<void> {
    await job.updateData({
      ...job.data,
      resultStored,
      body: { kind: AiQueueBodyKind.JSON },
    });
  }
}
