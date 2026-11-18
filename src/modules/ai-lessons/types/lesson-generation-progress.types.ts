import { LessonGenerationPhase } from '../enums/lesson-generation-phase.enum';
import { LessonStageType } from '../enums/lesson.enums';

/** Progress record of the single generation a lesson can run at a time. */
export interface LessonGenerationProgress {
  lessonId: string;
  theme: string;
  stage: LessonStageType;
  phase: LessonGenerationPhase;
  totalImages: number;
  completedImages: number;
  requestedById: string;
  /** ISO timestamps. */
  startedAt: string;
  updatedAt: string;
}

export interface LessonGenerationProgressStart {
  lessonId: string;
  theme: string;
  stage: LessonStageType;
  requestedById: string;
  /** Images the request asked for, when it is known before the text exists. */
  expectedImages?: number;
  /** A new request restarts the clock; a resumed attempt keeps it. */
  reset?: boolean;
}

export type LessonGenerationProgressPatch = Partial<
  Pick<LessonGenerationProgress, 'phase' | 'totalImages' | 'completedImages'>
>;

/** Storage boundary: Redis in the application, memory in specs. */
export interface LessonProgressStore {
  read(lessonId: string): Promise<string | null>;
  write(lessonId: string, value: string, ttlSeconds: number): Promise<void>;
  touch(lessonId: string, ttlSeconds: number): Promise<void>;
  remove(lessonId: string): Promise<void>;
  readAll(): Promise<string[]>;
}
