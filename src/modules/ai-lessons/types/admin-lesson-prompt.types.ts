import { LessonStageType } from '../enums/lesson.enums';

export type AdminLessonPromptView = {
  stage: LessonStageType;
  basePrompt: string;
  customPrompt: string | null;
  effectivePrompt: string;
  lockVersion: number | null;
  /**
   * When this admin last saved or reset the stage's guidance; `null` when the
   * stage was never customised. The guidance is personal: each admin has their
   * own row per category and stage.
   */
  updatedAt: string | null;
};
