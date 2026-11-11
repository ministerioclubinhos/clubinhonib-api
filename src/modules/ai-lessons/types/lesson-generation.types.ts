import {
  LessonStageStatus,
  LessonStageType,
  LessonVisualOrientation,
  LessonVisualType,
} from '../enums/lesson.enums';
import { LessonFailureCode } from '../enums/lesson-failure-code.enum';
import type {
  LessonAttemptProviderMetadata,
  LessonLlmUsage,
} from '../providers/lesson-llm.types';

export type LessonJsonObject = Record<string, unknown>;

/** What a stage looked like before generation started, restored on failure. */
export interface LessonStagePreviousState {
  status: LessonStageStatus;
}

/** Work already paid for in a previous attempt of the same request. */
export interface LessonGenerationCheckpoint {
  upstreamChecksum: string | null;
  content: LessonJsonObject;
  responseId: string;
  usage?: LessonLlmUsage;
  /** Asset id → uploaded URL. */
  assetUrls: Record<string, string>;
}

/**
 * Server-internal payload persisted in `lesson_stages.generation_request_json`.
 * Never bound to an HTTP body: every field beyond the user's choices is
 * computed by the server when the generation is requested.
 */
export interface LessonGenerationRequest {
  stage: LessonStageType;
  revisionInstructions?: string;
  visualType?: LessonVisualType;
  visualOrientation?: LessonVisualOrientation;
  visualQuantity?: number;
  frozenProvider?: LessonAttemptProviderMetadata;
  frozenAdminPrompt?: string;
  attempts?: number;
  /** Every object uploaded by any attempt of this request. */
  uploadedAssetUrls?: string[];
  checkpoint?: LessonGenerationCheckpoint | null;
  previousState?: LessonStagePreviousState;
}

export interface LessonVisualConfig {
  type: LessonVisualType;
  orientation: LessonVisualOrientation;
  quantity: number;
}

export interface LessonCanonicalVerse {
  text: string;
  reference: string;
  version: string;
}

export interface LessonAiFailure {
  code: LessonFailureCode;
  message: string;
}

export interface LessonAiFailureContext {
  /** Provider key of the attempt snapshot (`openai`, `gemini`). */
  provider?: string;
  /** Ordered stage list of the lesson category, for the item number. */
  stageOrder?: readonly LessonStageType[];
}

export interface LessonPdfFile {
  pdfBuffer: Buffer;
  fileName: string;
}

export interface LessonDraftPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LessonPublicationResult<T> {
  lesson: T;
  weekMaterialId: string;
}

export interface LessonUploadImageMetadata {
  extension: 'jpg' | 'png';
  mimeType: 'image/jpeg' | 'image/png';
}

/** Hooks that let an attempt reuse and record uploads across resumes. */
export interface LessonAssetCheckpointHooks {
  assetUrls: Record<string, string>;
  onUploaded: (assetId: string, url: string) => Promise<void>;
  signal?: AbortSignal;
}

export interface LessonActiveGeneration {
  stageId: string;
  attemptToken: string;
  heartbeat: NodeJS.Timeout;
  abort: AbortController;
}

export interface LessonEventDigestSource {
  id: string;
  status: string;
  weekMaterialId: string | null;
  publicationFailureMessage: string | null;
  stages: Array<{
    type: LessonStageType;
    status: LessonStageStatus;
    lockVersion: number;
    currentVersionId: string | null;
    failureCode: string | null;
    failureMessage: string | null;
  }>;
  commentCount: number;
}
