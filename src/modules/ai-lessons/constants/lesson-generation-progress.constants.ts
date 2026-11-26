export const LESSON_PROGRESS_STORE = Symbol('LESSON_PROGRESS_STORE');

/** Live progress of stage generations, kept in Redis next to the AI queue. */
export const LESSON_GENERATION_PROGRESS = {
  /** Redis key segment after the queue prefix. */
  namespace: 'lesson-generation',
  indexSuffix: 'active',
  /**
   * A record outlives a short API restart, so a resumed generation keeps its
   * start time; a dead one disappears on its own. Renewed by the heartbeat.
   */
  ttlSeconds: 120,
  commandMs: 2_000,
  /** The last step (saving) never shows as finished before the commit. */
  maxPercent: 99,
} as const;
