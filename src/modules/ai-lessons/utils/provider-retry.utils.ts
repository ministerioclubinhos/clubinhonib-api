import { ProviderRetryPolicy } from '../providers/lesson-llm.types';

function responseOf(
  error: unknown,
): { status?: unknown; headers?: unknown } | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error))
    return undefined;
  const response = (error as { response?: unknown }).response;
  return typeof response === 'object' && response !== null
    ? (response as { status?: unknown; headers?: unknown })
    : undefined;
}

export function providerHttpStatus(error: unknown): number | undefined {
  const status = responseOf(error)?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Retry-After as milliseconds (seconds or HTTP date), or null when absent/invalid. */
export function providerRetryAfterMs(
  error: unknown,
  now = Date.now(),
): number | null {
  const headers = responseOf(error)?.headers;
  if (!headers || typeof headers !== 'object') return null;
  const header: unknown = Reflect.get(headers, 'retry-after');
  if (typeof header !== 'string' && typeof header !== 'number') return null;
  const numeric = Number(header);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric * 1000;
  const date = typeof header === 'string' ? Date.parse(header) : NaN;
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

/**
 * Delay before the next attempt, or null when the error must not be retried.
 * A server hint longer than the cap is never retried early: the caller fails
 * fast instead of sleeping for minutes while holding a generation lease.
 */
export function providerRetryDelay(
  error: unknown,
  attempt: number,
  policy: ProviderRetryPolicy,
  random: () => number = Math.random,
): number | null {
  const status = providerHttpStatus(error);
  if (status === undefined || !policy.statuses.includes(status)) return null;
  if (attempt >= policy.maxRetries) return null;
  const hinted = providerRetryAfterMs(error);
  if (hinted !== null && hinted > policy.capMs) return null;
  const base =
    hinted ?? Math.min(policy.baseDelayMs * 2 ** attempt, policy.capMs);
  return Math.min(Math.ceil(base + random() * policy.jitterMs), policy.capMs);
}

export async function retryProviderRequest<T>(
  request: () => Promise<T>,
  policy: ProviderRetryPolicy,
  onRetry: (delayMs: number, attempt: number, error: unknown) => void,
  shouldRetry: (error: unknown) => boolean = () => true,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error: unknown) {
      const delay = shouldRetry(error)
        ? providerRetryDelay(error, attempt, policy)
        : null;
      if (delay === null) throw error;
      onRetry(delay, attempt, error);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}
