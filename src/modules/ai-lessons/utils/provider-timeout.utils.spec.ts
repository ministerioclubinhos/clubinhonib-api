import { LessonStageType } from '../enums/lesson.enums';
import { PROVIDER_REQUEST } from '../providers/lesson-llm.constants';
import { AI_QUEUE } from 'src/shared/providers/ai-queue/constants';
import { providerTextTimeoutMs } from './provider-timeout.utils';

describe('providerTextTimeoutMs', () => {
  it('dá mais tempo à lição e aos visuais da história, dentro do limite da fila', () => {
    expect(providerTextTimeoutMs(LessonStageType.LESSON)).toBe(
      PROVIDER_REQUEST.longTextTimeoutMs,
    );
    expect(providerTextTimeoutMs(LessonStageType.LESSON_VISUALS)).toBe(
      PROVIDER_REQUEST.longTextTimeoutMs,
    );
    expect(providerTextTimeoutMs(LessonStageType.STANDARD_GAME)).toBe(
      PROVIDER_REQUEST.textTimeoutMs,
    );
    expect(PROVIDER_REQUEST.longTextTimeoutMs).toBeLessThanOrEqual(
      AI_QUEUE.maxRequestMs,
    );
    expect(AI_QUEUE.lockMs).toBeGreaterThan(AI_QUEUE.maxRequestMs);
  });
});
