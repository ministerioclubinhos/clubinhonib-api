import { LessonStageType } from '../enums/lesson.enums';
import { PROVIDER_REQUEST } from '../providers/lesson-llm.constants';
import { AI_QUEUE } from 'src/shared/providers/ai-queue/constants';
import { providerTextTimeoutMs } from './provider-timeout.utils';

describe('providerTextTimeoutMs', () => {
  it('dá mais tempo só ao texto da lição, dentro do limite da fila', () => {
    expect(providerTextTimeoutMs(LessonStageType.LESSON)).toBe(
      PROVIDER_REQUEST.lessonTextTimeoutMs,
    );
    expect(providerTextTimeoutMs(LessonStageType.STANDARD_GAME)).toBe(
      PROVIDER_REQUEST.textTimeoutMs,
    );
    expect(PROVIDER_REQUEST.lessonTextTimeoutMs).toBeLessThanOrEqual(
      AI_QUEUE.maxRequestMs,
    );
    expect(AI_QUEUE.lockMs).toBeGreaterThan(AI_QUEUE.maxRequestMs);
  });
});
