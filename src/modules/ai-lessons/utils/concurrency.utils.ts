/**
 * Runs `task` for every item with at most `limit` in flight, preserving the
 * input order in the result. The first rejection is propagated after the
 * in-flight tasks settle; no new task starts once one has failed.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  let cursor = 0;
  let failed = false;
  const run = async (): Promise<void> => {
    while (!failed && cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await task(items[index], index);
      } catch (error: unknown) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: workers }, run));
  return results;
}

/** Limits how many of the wrapped calls run at the same time. */
export function createConcurrencyLimiter(
  limit: number,
): <R>(task: () => Promise<R>) => Promise<R> {
  const max = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  const waiting: Array<() => void> = [];
  const release = (): void => {
    active--;
    waiting.shift()?.();
  };
  return async <R>(task: () => Promise<R>): Promise<R> => {
    if (active >= max)
      await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}
