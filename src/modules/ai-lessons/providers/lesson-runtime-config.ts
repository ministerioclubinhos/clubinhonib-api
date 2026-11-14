import { LessonProviderConfig } from './lesson-llm.types';

/** A snapshot of database settings. Never reads process.env or ConfigService. */
export class LessonRuntimeConfig implements LessonProviderConfig {
  constructor(private readonly values: Record<string, string | number>) {}

  get<T = unknown>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}
