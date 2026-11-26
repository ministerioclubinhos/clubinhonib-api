import { ProviderRetryPolicy } from '../providers/lesson-llm.types';
import {
  providerRetryAfterMs,
  providerRetryDelay,
  retryProviderRequest,
} from './provider-retry.utils';

describe('provider retry policy', () => {
  const policy: ProviderRetryPolicy = {
    maxRetries: 3,
    baseDelayMs: 1000,
    capMs: 60_000,
    jitterMs: 250,
    statuses: [429, 503],
  };
  const error = (status: number, headers: Record<string, string> = {}) => ({
    response: { status, headers },
  });

  it('grows exponentially with jitter and never exceeds the cap', () => {
    expect(providerRetryDelay(error(503), 0, policy, () => 0)).toBe(1000);
    expect(providerRetryDelay(error(503), 2, policy, () => 1)).toBe(4250);
    expect(
      providerRetryDelay(
        error(503),
        2,
        { ...policy, baseDelayMs: 10_000_000 },
        () => 1,
      ),
    ).toBe(60_000);
  });

  it('honors Retry-After and refuses to wait beyond the cap', () => {
    expect(
      providerRetryDelay(
        error(429, { 'retry-after': '7' }),
        0,
        policy,
        () => 0,
      ),
    ).toBe(7000);
    expect(
      providerRetryDelay(error(429, { 'retry-after': '3600' }), 0, policy),
    ).toBeNull();
    const now = Date.parse('2026-11-10T12:00:00Z');
    expect(
      providerRetryAfterMs(
        error(429, { 'retry-after': 'Tue, 10 Nov 2026 12:00:05 GMT' }),
        now,
      ),
    ).toBe(5000);
  });

  it('does not retry other statuses, network errors or exhausted attempts', () => {
    expect(providerRetryDelay(error(500), 0, policy)).toBeNull();
    expect(providerRetryDelay(new Error('ECONNRESET'), 0, policy)).toBeNull();
    expect(providerRetryDelay(error(503), 3, policy)).toBeNull();
  });

  it('stops immediately when the caller vetoes the retry', async () => {
    const request = jest.fn().mockRejectedValue(error(503));
    await expect(
      retryProviderRequest(request, policy, jest.fn(), () => false),
    ).rejects.toEqual(error(503));
    expect(request).toHaveBeenCalledTimes(1);
  });
});
