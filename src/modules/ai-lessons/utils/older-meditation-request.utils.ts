import axios from 'axios';
import { OLDER_MEDITATION_REQUEST as R } from '../constants/older-meditation-request.constants';

export function olderMeditationRetryDelay(
  error: unknown,
  attempt: number,
): number | null {
  if (!axios.isAxiosError<unknown>(error) || error.response?.status !== 429)
    return null;
  const data = error.response.data;
  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const detail =
    payload.error && typeof payload.error === 'object'
      ? (payload.error as Record<string, unknown>)
      : {};
  if (!['rate_limit_exceeded', 'slow_down'].includes(String(detail.code)))
    return null;
  const header: unknown = error.response.headers['retry-after'];
  const numeric =
    typeof header === 'string' || typeof header === 'number'
      ? Number(header)
      : NaN;
  const date = typeof header === 'string' ? Date.parse(header) : NaN;
  const message =
    typeof detail.message === 'string'
      ? detail.message.match(/try again in ([\d.]+)s/i)
      : null;
  const delay =
    Number.isFinite(numeric) && numeric >= 0
      ? numeric * 1000
      : Number.isFinite(date)
        ? Math.max(0, date - Date.now())
        : message
          ? Number(message[1]) * 1000
          : R.fallbackDelayMs * 2 ** attempt;
  if (delay > R.maxDelayMs) return null;
  return Math.ceil(delay + Math.random() * R.jitterMs);
}

export async function retryOlderMeditationRequest<T>(
  request: () => Promise<T>,
  onRetry: (delay: number) => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request();
    } catch (error: unknown) {
      const delay =
        attempt < R.maxRetries
          ? olderMeditationRetryDelay(error, attempt)
          : null;
      if (delay === null) throw error;
      onRetry(delay);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}
