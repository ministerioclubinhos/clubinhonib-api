import { EventEmitter } from 'node:events';
import { Job, Queue, QueueEvents } from 'bullmq';
import { waitForAiJob } from './wait-for-ai-job.utils';
import { AiQueueCompletion, AiQueueRequest } from './types';

describe('AI queue result waiting', () => {
  const job = { id: 'request', getState: jest.fn() };
  const events = Object.assign(new EventEmitter(), {
    waitUntilReady: jest.fn(),
  });
  const queue = Object.assign(new EventEmitter(), { getJob: jest.fn() });
  const wait = () =>
    waitForAiJob(
      job as unknown as Job<AiQueueRequest, AiQueueCompletion>,
      queue as unknown as Queue<AiQueueRequest, AiQueueCompletion>,
      events as unknown as QueueEvents,
      1000,
    );
  beforeEach(() => {
    jest.resetAllMocks();
    job.getState.mockResolvedValue('active');
    events.waitUntilReady.mockResolvedValue(undefined);
  });
  afterEach(() => {
    expect(events.listenerCount('completed:request')).toBe(0);
    expect(events.listenerCount('failed:request')).toBe(0);
    expect(queue.listenerCount('closing')).toBe(0);
    jest.useRealTimers();
  });

  it('receives completion events and removes all request listeners', async () => {
    const pending = wait();
    events.emit('completed:request', { returnvalue: { resultKey: 'result' } });
    await expect(pending).resolves.toEqual({ resultKey: 'result' });
  });

  it('finds work that completed before subscription', async () => {
    job.getState.mockResolvedValue('completed');
    queue.getJob.mockResolvedValue({
      returnvalue: { resultKey: 'already-done' },
    });
    await expect(wait()).resolves.toEqual({ resultKey: 'already-done' });
  });

  it('handles a Redis error during the asynchronous state check without an unhandled rejection', async () => {
    job.getState.mockRejectedValue(
      new Error('connection lost with secret URL'),
    );
    await expect(wait()).rejects.toThrow('indisponível');
  });

  it('handles event connection errors without an unhandled rejection', async () => {
    events.waitUntilReady.mockRejectedValue(new Error('connection lost'));
    await expect(wait()).rejects.toThrow('indisponível');
  });

  it('handles expired jobs already failed before subscription', async () => {
    job.getState.mockResolvedValue('failed');
    queue.getJob.mockResolvedValue({ failedReason: 'AI_QUEUE_EXPIRED' });
    await expect(wait()).rejects.toThrow('tempo de espera');
  });

  it('handles removed work without waiting for a nonexistent notification', async () => {
    job.getState.mockResolvedValue('unknown');
    await expect(wait()).rejects.toThrow('tempo de espera');
  });

  it('bounds waiting time and cleans listeners after timeout', async () => {
    jest.useFakeTimers();
    const pending = expect(wait()).rejects.toThrow('tempo de espera');
    await jest.advanceTimersByTimeAsync(1000);
    await pending;
  });

  it('cleans pending waits when the producer closes', async () => {
    const pending = wait();
    queue.emit('closing');
    await expect(pending).rejects.toThrow('indisponível');
  });
});
