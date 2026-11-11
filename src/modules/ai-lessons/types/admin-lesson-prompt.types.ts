import { LessonStageType } from '../enums/lesson.enums';

export type AdminLessonPromptView = {
  stage: LessonStageType;
  basePrompt: string;
  customPrompt: string | null;
  effectivePrompt: string;
  lockVersion: number | null;
};
