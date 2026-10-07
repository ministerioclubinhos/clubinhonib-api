import { AxiosError, AxiosHeaders } from 'axios';
import {
  olderMeditationRetryDelay,
  retryOlderMeditationRequest,
} from './older-meditation-request.utils';

function rateLimit(
  code = 'rate_limit_exceeded',
  retryAfter?: string,
  message = '',
): AxiosError {
  return new AxiosError('HTTP 429', undefined, undefined, undefined, {
    status: 429,
    statusText: 'Too Many Requests',
    data: { error: { code, message } },
    headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter },
    config: { headers: new AxiosHeaders() },
  });
}

describe('older meditation temporary rate limits', () => {
  afterEach(() => jest.useRealTimers());
  it('honors provider headers and the fractional wait in the reported error', () => {
    const delay = olderMeditationRetryDelay(
      rateLimit(
        'rate_limit_exceeded',
        undefined,
        'Please try again in 9.136s.',
      ),
      0,
    )!;
    expect(delay).toBeGreaterThanOrEqual(9136);
    expect(delay).toBeLessThanOrEqual(9386);
    expect(
      olderMeditationRetryDelay(rateLimit('rate_limit_exceeded', '12'), 0),
    ).toBeGreaterThanOrEqual(12000);
    expect(
      olderMeditationRetryDelay(rateLimit('rate_limit_exceeded', '120'), 0),
    ).toBeNull();
    expect(
      olderMeditationRetryDelay(rateLimit('insufficient_quota', '1'), 0),
    ).toBeNull();
    expect(olderMeditationRetryDelay(new Error('local failure'), 0)).toBeNull();
  });
  it('waits before retrying the same request and returns its successful response', async () => {
    jest.useFakeTimers();
    const request = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(rateLimit('rate_limit_exceeded', '10'))
      .mockResolvedValue('complete');
    const retry = jest.fn();
    const result = retryOlderMeditationRequest(request, retry);
    await jest.advanceTimersByTimeAsync(9999);
    expect(request).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(251);
    await expect(result).resolves.toBe('complete');
    expect(request).toHaveBeenCalledTimes(2);
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it('bounds retries and never retries billing failures', async () => {
    jest.useFakeTimers();
    const error = rateLimit('rate_limit_exceeded', '1');
    const request = jest.fn<Promise<string>, []>().mockRejectedValue(error);
    const result = retryOlderMeditationRequest(request, jest.fn());
    const assertion = expect(result).rejects.toBe(error);
    await jest.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(request).toHaveBeenCalledTimes(3);
    const billing = rateLimit('billing_not_active', '1');
    request.mockClear().mockRejectedValue(billing);
    await expect(retryOlderMeditationRequest(request, jest.fn())).rejects.toBe(
      billing,
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
