import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { AiRequestProcessor } from './ai-request.processor';
import { AiProviderTransportProvider } from './ai-provider-transport.provider';
import {
  AiQueueBodyKind,
  AiQueueFeature,
  AiQueueMethod,
  AiQueueProviderName,
  AiQueueFailure,
} from './enums';
import { AiQueueRequest } from './types';
import { AI_QUEUE } from './constants';

describe('AI request worker', () => {
  const transport = { execute: jest.fn() };
  const redis = {
    exists: jest.fn(),
    set: jest.fn<Promise<string>, [string, string, string, number]>(),
  };
  const processor = new AiRequestProcessor(
    transport as unknown as AiProviderTransportProvider,
  );
  const data = (): AiQueueRequest => ({
    feature: AiQueueFeature.LESSONS,
    provider: AiQueueProviderName.OPENAI,
    method: AiQueueMethod.POST,
    url: 'https://api.openai.com/v1/responses',
    body: { kind: AiQueueBodyKind.JSON, json: { input: 'private prompt' } },
    timeoutMs: 120000,
    expiresAt: Date.now() + 120000,
    maxContentLength: AI_QUEUE.maxResponseBytes,
  });
  const job = () => ({
    id: 'request',
    data: data(),
    updateData: jest.fn().mockResolvedValue(undefined),
  });
  const execute = (value: ReturnType<typeof job>) =>
    processor.process(
      value as unknown as Job<AiQueueRequest>,
      redis as unknown as Redis,
      'test',
    );

  beforeEach(() => {
    jest.resetAllMocks();
    redis.exists.mockResolvedValue(0);
    redis.set.mockResolvedValue('OK');
    jest.replaceProperty(AI_QUEUE, 'resultWriteBackoffMs', 1 as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('stores expiring results separately and removes prompt/attachments from completed jobs', async () => {
    transport.execute.mockResolvedValue({
      data: { output: 'result' },
      status: 200,
      headers: {},
    });
    const current = job();
    await expect(execute(current)).resolves.toEqual({
      resultKey: 'test:llm-result:request',
    });
    expect(redis.set).toHaveBeenCalledWith(
      'test:llm-result:request',
      expect.stringContaining('result'),
      'PX',
      AI_QUEUE.resultTtlMs,
    );
    expect(JSON.stringify(current.updateData.mock.lastCall)).not.toContain(
      'private prompt',
    );
  });

  it.each([AiQueueFailure.EXPIRED, AiQueueFailure.CANCELLED])(
    'does not call a provider for %s jobs',
    async (reason) => {
      const current = job();
      if (reason === AiQueueFailure.EXPIRED)
        current.data.expiresAt = Date.now() - 1;
      else redis.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      await expect(execute(current)).rejects.toThrow(reason);
      expect(transport.execute).not.toHaveBeenCalled();
      expect(current.updateData).toHaveBeenCalled();
    },
  );

  it('reuses a persisted response after worker recovery', async () => {
    redis.exists.mockResolvedValueOnce(1);
    await expect(execute(job())).resolves.toEqual({
      resultKey: 'test:llm-result:request',
    });
    expect(transport.execute).not.toHaveBeenCalled();
  });

  it('never dispatches cleared work after its result TTL expires', async () => {
    const current = job();
    current.data.resultStored = true;
    await expect(execute(current)).rejects.toThrow(
      AiQueueFailure.RESULT_EXPIRED,
    );
    expect(transport.execute).not.toHaveBeenCalled();
  });

  it('returns sanitized failures without retrying the paid request inside BullMQ', async () => {
    transport.execute.mockRejectedValue({
      response: { status: 503, data: 'secret' },
    });
    await execute(job());
    const stored = String(redis.set.mock.calls[0][1]);
    expect(stored).toContain('503');
    expect(stored).not.toContain('secret');
    expect(transport.execute).toHaveBeenCalledTimes(1);
  });

  it('does not erase a request if its response could not be persisted', async () => {
    transport.execute.mockResolvedValue({ data: {}, status: 200, headers: {} });
    redis.set.mockRejectedValue(new Error('Redis unavailable'));
    const current = job();
    await expect(execute(current)).rejects.toThrow('Redis unavailable');
    expect(current.updateData).not.toHaveBeenCalled();
  });

  it('drops jobs whose producer process is gone instead of paying for an unread answer', async () => {
    const current = job();
    current.data.producerId = 'dead-producer';
    await expect(execute(current)).rejects.toThrow(AiQueueFailure.ORPHANED);
    expect(redis.exists).toHaveBeenCalledWith(
      'test:llm-producer:dead-producer',
    );
    expect(transport.execute).not.toHaveBeenCalled();
    expect(current.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ body: { kind: AiQueueBodyKind.JSON } }),
    );

    redis.exists.mockImplementation((key: string) =>
      Promise.resolve(key.includes('llm-producer') ? 1 : 0),
    );
    transport.execute.mockResolvedValue({ data: {}, status: 200, headers: {} });
    await expect(execute(current)).resolves.toEqual({
      resultKey: 'test:llm-result:request',
    });
  });

  it('retries only the result write and never calls the provider twice', async () => {
    try {
      transport.execute.mockResolvedValue({
        data: { output: 'paid answer' },
        status: 200,
        headers: {},
      });
      redis.set
        .mockRejectedValueOnce(new Error('Command timed out'))
        .mockRejectedValueOnce(new Error('Command timed out'))
        .mockResolvedValue('OK');
      await expect(execute(job())).resolves.toEqual({
        resultKey: 'test:llm-result:request',
      });
      expect(transport.execute).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(3);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('logs identifiers and timings without prompts, bodies or keys', async () => {
    const lines: string[] = [];
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((line: string) => void lines.push(line));
    try {
      transport.execute.mockResolvedValue({
        data: { output: 'secret answer' },
        status: 200,
        headers: { 'x-request-id': 'req_123' },
      });
      await execute(job());
      expect(lines.join('\n')).toMatch(
        /jobId=request feature=lessons provider=openai path=\/v1\/responses outcome=ok status=200 requestId=req_123 ms=\d+/,
      );
      expect(lines.join('\n')).not.toMatch(/private prompt|secret answer/);
    } finally {
      log.mockRestore();
    }
  });
});
