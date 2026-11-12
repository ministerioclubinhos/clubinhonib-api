import { LessonStageType } from '../enums/lesson.enums';
import {
  LONG_TEXT_STAGES,
  PROVIDER_REQUEST,
} from '../providers/lesson-llm.constants';

/** Text deadline of a stage: the lesson and the story visuals answer far more text. */
export function providerTextTimeoutMs(stage: LessonStageType): number {
  return LONG_TEXT_STAGES.includes(stage)
    ? PROVIDER_REQUEST.longTextTimeoutMs
    : PROVIDER_REQUEST.textTimeoutMs;
}
