import type { LessonProgressStore } from '../types/lesson-generation-progress.types';

/** In-memory stand-in for the Redis progress store. */
export class MemoryLessonProgressStore implements LessonProgressStore {
  readonly records = new Map<string, string>();
  /** When set, every command rejects, as a Redis outage would. */
  failure: Error | null = null;

  read(lessonId: string): Promise<string | null> {
    return this.run(() => this.records.get(lessonId) ?? null);
  }

  write(lessonId: string, value: string): Promise<void> {
    return this.run(() => void this.records.set(lessonId, value));
  }

  touch(): Promise<void> {
    return this.run(() => undefined);
  }

  remove(lessonId: string): Promise<void> {
    return this.run(() => void this.records.delete(lessonId));
  }

  readAll(): Promise<string[]> {
    return this.run(() => [...this.records.values()]);
  }

  private run<T>(action: () => T): Promise<T> {
    return this.failure
      ? Promise.reject(this.failure)
      : Promise.resolve(action());
  }
}
