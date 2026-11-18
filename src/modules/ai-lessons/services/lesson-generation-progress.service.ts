import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LESSON_GENERATION_PROGRESS,
  LESSON_PROGRESS_STORE,
} from '../constants/lesson-generation-progress.constants';
import { LessonGenerationPhase } from '../enums/lesson-generation-phase.enum';
import type {
  LessonGenerationProgress,
  LessonGenerationProgressPatch,
  LessonGenerationProgressStart,
  LessonProgressStore,
} from '../types/lesson-generation-progress.types';
import { parseGenerationProgress } from '../utils/lesson-generation-progress.utils';

/**
 * Where a running generation stands (phase, images done) and which lessons
 * are generating. It is a view for the screens: the database stays the source
 * of truth, and a store outage only hides the detail — it never fails a
 * generation or a request.
 */
@Injectable()
export class LessonGenerationProgressService {
  private readonly logger = new Logger(LessonGenerationProgressService.name);

  constructor(
    @Inject(LESSON_PROGRESS_STORE) private readonly store: LessonProgressStore,
  ) {}

  /** Opens the record. A resumed attempt of the same stage keeps what exists. */
  async begin(start: LessonGenerationProgressStart): Promise<void> {
    await this.guard('iniciar', async () => {
      const current = parseGenerationProgress(
        await this.store.read(start.lessonId),
      );
      if (current && current.stage === start.stage && !start.reset) {
        await this.store.touch(
          start.lessonId,
          LESSON_GENERATION_PROGRESS.ttlSeconds,
        );
        return;
      }
      const now = new Date().toISOString();
      await this.save({
        lessonId: start.lessonId,
        theme: start.theme,
        stage: start.stage,
        phase: LessonGenerationPhase.WRITING,
        totalImages: Math.max(0, start.expectedImages ?? 0),
        completedImages: 0,
        requestedById: start.requestedById,
        startedAt: now,
        updatedAt: now,
      });
    });
  }

  async advance(
    lessonId: string,
    patch: LessonGenerationProgressPatch,
  ): Promise<void> {
    await this.guard('atualizar', async () => {
      const current = parseGenerationProgress(await this.store.read(lessonId));
      if (!current) return;
      await this.save({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    });
  }

  /** Keeps the record alive while the generation holds its lease. */
  async touch(lessonId: string): Promise<void> {
    await this.guard('renovar', () =>
      this.store.touch(lessonId, LESSON_GENERATION_PROGRESS.ttlSeconds),
    );
  }

  async finish(lessonId: string): Promise<void> {
    await this.guard('encerrar', () => this.store.remove(lessonId));
  }

  async get(lessonId: string): Promise<LessonGenerationProgress | null> {
    return (
      (await this.guard('ler', async () =>
        parseGenerationProgress(await this.store.read(lessonId)),
      )) ?? null
    );
  }

  /** Every generation in progress, oldest first. */
  async listActive(): Promise<LessonGenerationProgress[]> {
    const records = await this.guard('listar', () => this.store.readAll());
    return (records ?? [])
      .map((raw) => parseGenerationProgress(raw))
      .filter((item): item is LessonGenerationProgress => item !== null)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  private save(progress: LessonGenerationProgress): Promise<void> {
    return this.store.write(
      progress.lessonId,
      JSON.stringify(progress),
      LESSON_GENERATION_PROGRESS.ttlSeconds,
    );
  }

  private async guard<T>(
    action: string,
    run: () => Promise<T>,
  ): Promise<T | undefined> {
    try {
      return await run();
    } catch (error: unknown) {
      this.logger.debug(
        `Não foi possível ${action} o progresso de geração: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }
}
