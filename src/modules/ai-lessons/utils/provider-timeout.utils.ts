import { LessonStageType } from '../enums/lesson.enums';
import { PROVIDER_REQUEST } from '../providers/lesson-llm.constants';

/** Text deadline of a stage: the lesson is far longer than any other item. */
export function providerTextTimeoutMs(stage: LessonStageType): number {
  return stage === LessonStageType.LESSON
    ? PROVIDER_REQUEST.lessonTextTimeoutMs
    : PROVIDER_REQUEST.textTimeoutMs;
}
