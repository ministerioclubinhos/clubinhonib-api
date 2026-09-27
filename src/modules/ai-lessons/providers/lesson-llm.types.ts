import { LessonStageType } from '../enums/lesson.enums';
import { LessonTemplateContract } from '../templates/lesson-templates';

export enum LessonLlmProvider {
  OPENAI = 'openai',
  GEMINI = 'gemini',
}

export type LessonLlmGenerationResult = {
  content: Record<string, unknown>;
  responseId: string;
};

export type LessonLlmGenerationInput = {
  theme: string;
  biblicalReference: string;
  weekNumber: number;
  stage: LessonStageType;
  template: LessonTemplateContract;
  approvedUpstream: Record<string, unknown> | null;
  adminPrompt: string;
  revisionInstructions?: string;
  visualConfig?: {
    type: string;
    orientation: string;
    quantity: number;
  } | null;
};

export interface LessonLlmProviderContract {
  generateStage(
    input: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult>;

  generateImage(
    prompt: string,
    orientation?: string,
    visualType?: string,
  ): Promise<Buffer>;
}
