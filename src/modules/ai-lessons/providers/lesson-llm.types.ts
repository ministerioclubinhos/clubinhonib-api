import { LessonCategory, LessonStageType } from '../enums/lesson.enums';
import { LessonTemplateContract } from '../templates/lesson-templates';
import type { LessonStructuredRequest } from '../types/lesson-image-brief.types';

export enum LessonImagePurpose {
  MEDITATION_ACTIVITY = 'MEDITATION_ACTIVITY',
  MANUAL_COLORING = 'MANUAL_COLORING',
  CUTOUT_SHEET = 'CUTOUT_SHEET',
  /** Fun-game infographic: short Portuguese labels are part of the art. */
  GAME_SUMMARY = 'GAME_SUMMARY',
}

export enum LessonLlmProvider {
  OPENAI = 'openai',
  GEMINI = 'gemini',
}

/** Token accounting reported by the provider for one text call. */
export interface LessonLlmUsage {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type LessonLlmGenerationResult = {
  content: Record<string, unknown>;
  responseId: string;
  usage?: LessonLlmUsage;
};

export interface ProviderRetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  capMs: number;
  jitterMs: number;
  statuses: readonly number[];
}

export interface ProviderImageFormat {
  mimeType: 'image/png' | 'image/jpeg';
  extension: 'png' | 'jpg';
}

export type LessonLlmGenerationInput = {
  theme: string;
  biblicalReference: string;
  weekNumber: number | null;
  category?: LessonCategory;
  specialContext?: string | null;
  /** Admin-defined purpose; an instruction, sent in the system prompt. */
  editorialPurpose?: string | null;
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
    style?: string;
  } | null;
  /**
   * Replaces the stage template: the provider sends this system text, user
   * payload and schema, keeping its own retries, limits and accounting.
   */
  structuredRequest?: LessonStructuredRequest;
};

/** One stored image handed to the provider as a visual reference. */
export type LessonImageReferenceFile = {
  data: Buffer;
  mimeType: string;
};

export type LessonImageReference = {
  /**
   * Other images of the same set, sent along with the main reference so a
   * replacement matches the style and faces of what stays in use.
   */
  companions?: LessonImageReferenceFile[];
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
};

export interface LessonImageContext {
  category: LessonCategory;
}

/**
 * Non-secret provider parameters frozen for one generation attempt. Persisted
 * with the request so a resumed attempt uses the same configuration. Fields
 * beyond the first three are optional for requests persisted before they
 * existed. Never carries an API key.
 */
export interface LessonAttemptProviderMetadata {
  provider: string;
  textModel: string;
  imageModel: string;
  imageQuality?: string;
  reasoningEffort?: string;
  fallbackModel?: string;
  imageSize?: string;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface LessonAttemptProviderSnapshot {
  provider: LessonLlmProviderContract;
  metadata: LessonAttemptProviderMetadata;
}

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
    context?: LessonImageContext,
  ): Promise<Buffer>;

  /**
   * A structured text call outside the stage templates (the master image
   * prompt). `context` carries the lesson fields the provider logs.
   */
  generateStructured?(
    request: LessonStructuredRequest,
    context: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult>;

  createAttemptProvider?(
    frozen?: LessonAttemptProviderMetadata,
  ): Promise<LessonAttemptProviderSnapshot>;
}

export interface LessonProviderConfig {
  get<T = unknown>(key: string): T | undefined;
}
