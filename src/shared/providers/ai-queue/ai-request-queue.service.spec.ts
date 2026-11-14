import { waitForAiJob } from './wait-for-ai-job.utils';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { AxiosError } from 'axios';
import { AiRequestQueueService } from './ai-request-queue.service';
import { AiRequestProcessor } from './ai-request.processor';
import { AiQueueFeature, AiQueueFailure } from './enums';
import { AI_QUEUE } from './constants';

jest.mock('./wait-for-ai-job.utils');
const completion = jest.mocked(waitForAiJob);

jest.mock('bullmq', () => ({
  Queue: jest.fn(),
  QueueEvents: jest.fn(),
  Worker: jest.fn(),
}));
jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn() }));

describe('central AI queue', () => {
  const redis = {
    status: 'ready',
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    getdel: jest.fn(),
    set: jest.fn<Promise<string>, [string, string, string, number]>(),
    del: jest.fn(),
  };
  const job = { remove: jest.fn() };
  const queue = {
    on: jest.fn(),
    waitUntilReady: jest.fn(),
    setGlobalConcurrency: jest.fn(),
    setMaxListeners: jest.fn(),
    add: jest.fn<Promise<typeof job>, [string, unknown, object]>(),
    close: jest.fn(),
    clean: jest.fn(),
  };
  const events = { on: jest.fn(), waitUntilReady: jest.fn(), close: jest.fn() };
  const worker = {
    on: jest.fn(),
    waitUntilReady: jest.fn(),
    close: jest.fn(),
    run: jest.fn(),
  };
  const processor = { process: jest.fn() };
  let service: AiRequestQueueService;
  const options = { feature: AiQueueFeature.LESSONS, timeout: 120000 };
  const url = 'https://api.openai.com/v1/responses';

  beforeEach(() => {
    jest.resetAllMocks();
    redis.status = 'ready';
    redis.connect.mockResolvedValue(undefined);
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
    // Outage tests must not sleep through the real reconnection budget.
    jest.replaceProperty(AI_QUEUE, 'reconnectWaitMs', 0 as never);
    redis.getdel.mockResolvedValue(
      JSON.stringify({
        success: true,
        response: { data: { output: 'answer' }, status: 200, headers: {} },
      }),
    );
    queue.add.mockResolvedValue(job);
    queue.close.mockResolvedValue(undefined);
    queue.waitUntilReady.mockResolvedValue(undefined);
    events.waitUntilReady.mockResolvedValue(undefined);
    worker.waitUntilReady.mockResolvedValue(undefined);
    worker.run.mockResolvedValue(undefined);
    job.remove.mockResolvedValue(undefined);
    completion.mockResolvedValue({
      resultKey: 'test:llm-result:request',
    });
    jest.mocked(Redis).mockImplementation(() => redis as unknown as Redis);
    jest.mocked(Queue).mockImplementation(() => queue as never);
    jest.mocked(QueueEvents).mockImplementation(() => events as never);
    jest.mocked(Worker).mockImplementation(() => worker as never);
    service = new AiRequestQueueService(
      new ConfigService({ AI_QUEUE_PREFIX: 'test', AI_QUEUE_CONCURRENCY: 2 }),
      processor as unknown as AiRequestProcessor,
    );
  });
  afterEach(async () => {
    await service.onModuleDestroy();
    jest.restoreAllMocks();
  });
  const cancelKeys = (): string[] =>
    redis.set.mock.calls
      .map(([key]) => key)
      .filter((key) => /^test:llm-cancel:/.test(key));

  it('sets Redis global concurrency before consuming and disables extra provider retries in BullMQ', async () => {
    await service.onModuleInit();
    expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(2);
    expect(queue.setGlobalConcurrency.mock.invocationCallOrder[0]).toBeLessThan(
      worker.run.mock.invocationCallOrder[0],
    );
    expect(Queue).toHaveBeenCalledWith(
      AI_QUEUE.name,
      expect.objectContaining({
        prefix: 'test',
        defaultJobOptions: expect.objectContaining({ attempts: 1 }) as unknown,
      }),
    );
    expect(Worker).toHaveBeenCalledWith(
      AI_QUEUE.name,
      expect.any(Function),
      expect.objectContaining({
        autorun: false,
        concurrency: 2,
        lockDuration: AI_QUEUE.lockMs,
      }),
    );
  });

  it('enqueues the request and consumes/removes its expiring response', async () => {
    await service.onModuleInit();
    await expect(
      service.post(url, { model: 'pinned-model', input: 'prompt' }, options),
    ).resolves.toMatchObject({ data: { output: 'answer' } });
    const request: unknown = queue.add.mock.calls[0][1];
    expect(request).toMatchObject({
      provider: 'openai',
      feature: 'lessons',
      method: 'POST',
      body: { json: { model: 'pinned-model' } },
    });
    expect(request).not.toHaveProperty('headers');
    expect(request).not.toHaveProperty('apiKey');
    expect(completion).toHaveBeenCalledWith(
      job,
      queue,
      events,
      AI_QUEUE.waitMs + options.timeout + AI_QUEUE.terminalGraceMs,
    );
    expect(redis.getdel).toHaveBeenCalledWith('test:llm-result:request');
    expect(job.remove).toHaveBeenCalled();
  });

  it('also enqueues model catalog GET requests', async () => {
    await service.onModuleInit();
    await service.get('https://api.openai.com/v1/models', {
      feature: AiQueueFeature.PROVIDER_SETTINGS,
      timeout: 5000,
    });
    expect(queue.add).toHaveBeenCalledWith(
      AI_QUEUE.jobName,
      expect.objectContaining({ method: 'GET', feature: 'provider_settings' }),
      expect.any(Object),
    );
  });

  it('fails closed before initialization and during Redis outages', async () => {
    await expect(service.post(url, {}, options)).rejects.toThrow(
      'indisponível',
    );
    await service.onModuleInit();
    redis.status = 'reconnecting';
    await expect(service.post(url, {}, options)).rejects.toThrow(
      'indisponível',
    );
    expect(processor.process).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('keeps the API booting without Redis, degrades AI routes and retries the startup', async () => {
    jest.useFakeTimers();
    try {
      redis.connect.mockRejectedValue(new Error('connect ECONNREFUSED'));
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(redis.disconnect).toHaveBeenCalled();
      expect(worker.run).not.toHaveBeenCalled();
      await expect(service.post(url, {}, options)).rejects.toThrow(
        'indisponível',
      );
      redis.connect.mockResolvedValue(undefined);
      await jest.advanceTimersByTimeAsync(AI_QUEUE.startRetryMs);
      expect(worker.run).toHaveBeenCalledTimes(1);
      await expect(service.post(url, {}, options)).resolves.toMatchObject({
        status: 200,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('waits briefly for Redis to come back instead of failing the request', async () => {
    jest.replaceProperty(AI_QUEUE, 'reconnectWaitMs', 2000 as never);
    await service.onModuleInit();
    redis.status = 'reconnecting';
    setTimeout(() => (redis.status = 'ready'), 300);
    await expect(service.post(url, {}, options)).resolves.toMatchObject({
      status: 200,
    });
  });

  it('identifies the producer, keeps it alive and prioritizes interactive lookups', async () => {
    await service.onModuleInit();
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^test:llm-producer:/),
      '1',
      'PX',
      AI_QUEUE.producerTtlMs,
    );
    await service.post(url, {}, options);
    await service.get('https://api.openai.com/v1/models', {
      feature: AiQueueFeature.PROVIDER_SETTINGS,
      timeout: 5000,
      waitMs: 10_000,
    });
    const [lesson, catalog] = queue.add.mock.calls;
    expect(lesson[1]).toMatchObject({
      producerId: expect.any(String) as unknown,
    });
    expect(lesson[2]).toMatchObject({ priority: AI_QUEUE.defaultPriority });
    expect(catalog[2]).toMatchObject({
      priority: AI_QUEUE.interactivePriority,
    });
    expect(completion).toHaveBeenLastCalledWith(
      job,
      queue,
      events,
      10_000 + 5000 + AI_QUEUE.terminalGraceMs,
    );
    await service.onModuleDestroy();
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringMatching(/^test:llm-producer:/),
    );
  });

  it('surfaces transport failures such as a missing credential as queue failures', async () => {
    await service.onModuleInit();
    redis.getdel.mockResolvedValue(
      JSON.stringify({
        success: false,
        error: {
          queueFailure: AiQueueFailure.CREDENTIAL_MISSING,
          headers: {},
          freeTierQuota: false,
        },
      }),
    );
    await expect(service.post(url, {}, options)).rejects.toMatchObject({
      reason: AiQueueFailure.CREDENTIAL_MISSING,
      message: expect.stringContaining('API_KEY não configurada') as unknown,
    });
  });

  it.each(['add', 'wait'])(
    'cancels ambiguous %s failures without direct fallback',
    async (phase) => {
      await service.onModuleInit();
      if (phase === 'add') queue.add.mockRejectedValue(new Error('timeout'));
      else completion.mockRejectedValue(new Error('timeout'));
      await expect(service.post(url, {}, options)).rejects.toThrow(
        'indisponível',
      );
      expect(cancelKeys()).toHaveLength(1);
      expect(processor.process).not.toHaveBeenCalled();
    },
  );

  it('preserves sanitized provider HTTP errors for feature retry policies', async () => {
    await service.onModuleInit();
    redis.getdel.mockResolvedValue(
      JSON.stringify({
        success: false,
        error: {
          status: 429,
          headers: {},
          freeTierQuota: false,
          providerCode: 'rate_limit_exceeded',
        },
      }),
    );
    await expect(service.post(url, {}, options)).rejects.toBeInstanceOf(
      AxiosError,
    );
    expect(cancelKeys()).toHaveLength(0);
    expect(job.remove).toHaveBeenCalled();
  });

  it.each([AiQueueFailure.EXPIRED, AiQueueFailure.RESULT_EXPIRED])(
    'reports expired work/result %s',
    async (reason) => {
      await service.onModuleInit();
      if (reason === AiQueueFailure.EXPIRED)
        completion.mockRejectedValue(new Error(reason));
      else redis.getdel.mockResolvedValue(null);
      await expect(service.post(url, {}, options)).rejects.toThrow(
        'tempo de espera',
      );
    },
  );

  it('rejects arbitrary destinations and invalid timeouts before enqueueing', async () => {
    await service.onModuleInit();
    await expect(
      service.post('http://localhost', {}, options),
    ).rejects.toThrow();
    await expect(
      service.post(url, {}, { ...options, timeout: -1 }),
    ).rejects.toThrow();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('stops accepting requests after shutdown', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();
    await expect(service.post(url, {}, options)).rejects.toThrow(
      'indisponível',
    );
    expect(worker.close).toHaveBeenCalledWith(true);
  });
});
