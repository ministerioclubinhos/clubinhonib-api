import { AiRequestQueueService } from '../ai-request-queue.service';
import { AiQueueRequestOptions } from '../types';

export function createAiQueueMock() {
  const post = jest.fn<
    Promise<{ data: unknown }>,
    [string, object, AiQueueRequestOptions]
  >();
  const get = jest.fn<
    Promise<{ data: unknown }>,
    [string, AiQueueRequestOptions]
  >();
  return {
    post,
    get,
    service: { post, get } as unknown as AiRequestQueueService,
  };
}
