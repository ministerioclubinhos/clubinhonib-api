import { Job, Queue, QueueEvents } from 'bullmq';
import { EventEmitter } from 'node:events';
import {
  AiQueueCompletion,
  AiQueueRequest,
  AiQueueCompletedEvent,
  AiQueueFailedEvent,
} from './types';
import { AiQueueFailure } from './enums';
import { AiQueueException } from './ai-queue.exception';

/** Own the async error boundary: Redis can disconnect during the initial state check. */
export function waitForAiJob(
  job: Job<AiQueueRequest, AiQueueCompletion>,
  queue: Queue<AiQueueRequest, AiQueueCompletion>,
  events: QueueEvents,
  timeoutMs: number,
): Promise<AiQueueCompletion> {
  return new Promise((resolve, reject) => {
    // BullMQ emits job-specific and closing events but omits them from its listener overloads.
    const jobEvents: EventEmitter = events;
    const producerEvents: EventEmitter = queue;
    const completedEvent = `completed:${job.id}`;
    const failedEvent = `failed:${job.id}`;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      events.removeListener(completedEvent, completed);
      events.removeListener(failedEvent, failed);
      queue.removeListener('closing', closing);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        error instanceof AiQueueException
          ? error
          : new AiQueueException(AiQueueFailure.UNAVAILABLE),
      );
    };
    const completed = (event: AiQueueCompletedEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(event.returnvalue);
    };
    const failed = (event: AiQueueFailedEvent) => {
      const reason = Object.values(AiQueueFailure).find(
        (value) => value === (event.failedReason as AiQueueFailure),
      );
      fail(
        new AiQueueException(
          reason === AiQueueFailure.RESULT_EXPIRED
            ? AiQueueFailure.EXPIRED
            : (reason ?? AiQueueFailure.UNAVAILABLE),
        ),
      );
    };
    const closing = () =>
      fail(new AiQueueException(AiQueueFailure.UNAVAILABLE));
    const timer = setTimeout(
      () => fail(new AiQueueException(AiQueueFailure.EXPIRED)),
      timeoutMs,
    );
    jobEvents.on(completedEvent, completed);
    jobEvents.on(failedEvent, failed);
    producerEvents.on('closing', closing);

    // Subscribe first, then inspect: completion may have preceded registration.
    const inspect = async () => {
      await events.waitUntilReady();
      const state = await job.getState();
      if (settled) return;
      if (state === 'unknown')
        throw new AiQueueException(AiQueueFailure.RESULT_EXPIRED);
      if (state !== 'completed' && state !== 'failed') return;
      const stored = await queue.getJob(job.id!);
      if (!stored) throw new AiQueueException(AiQueueFailure.RESULT_EXPIRED);
      if (state === 'completed') completed({ returnvalue: stored.returnvalue });
      else failed({ failedReason: stored.failedReason });
    };
    void inspect().catch(fail);
  });
}
