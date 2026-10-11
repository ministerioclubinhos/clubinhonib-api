import { LessonStageType } from '../enums/lesson.enums';
import { LessonTemplateContract } from '../templates/lesson-templates';

export enum LessonImagePurpose {
  MEDITATION_ACTIVITY = 'MEDITATION_ACTIVITY',
  MANUAL_COLORING = 'MANUAL_COLORING',
}

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
  previousVariants?: Array<Record<string, unknown>>;
  canonicalVerse?: {
    text: string;
    reference: string;
    version: string;
  } | null;
  adminPrompt: string;
  revisionInstructions?: string;
  olderMeditationReview?: {
    content: Record<string, unknown>;
    images: Array<{ activityNumber: number; image: LessonImageReference }>;
  };
  visualConfig?: {
    type: string;
    orientation: string;
    quantity: number;
  } | null;
};

export type LessonImageReference = {
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
};

export interface LessonLlmProviderContract {
  generateStage(
    input: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult>;

  generateImage(
    prompt: string,
    orientation?: string,
    visualType?: string,
    identityReferenceImage?: LessonImageReference,
    purpose?: LessonImagePurpose,
  ): Promise<Buffer>;
}

export interface LessonProviderConfig {
  get<T = unknown>(key: string): T | undefined;
}
