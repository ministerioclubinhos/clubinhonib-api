import { LessonImageBriefOrigin } from '../enums/lesson-image-brief.enum';

/** Fixed look of one character or place of the lesson. */
export interface LessonImageBriefSubject {
  name: string;
  appearance: string;
}

/** The slice of the master prompt that belongs to one image. */
export interface LessonImageBriefPart {
  assetId: string;
  prompt: string;
  /** Names from `cast` that appear in this image. */
  cast: string[];
  /** Names from `settings` that appear in this image. */
  settings: string[];
}

/**
 * Master image prompt of one version ("promptzão"): art direction written for
 * this lesson from the base rules, the administrator's guidance and the lesson
 * itself, split into one part per image. Stored with the content so that
 * regenerating some images reuses it word for word.
 */
export interface LessonImageBrief {
  version: number;
  origin: LessonImageBriefOrigin;
  /** Changes when the planned images change; a stale brief is rebuilt. */
  planFingerprint: string;
  artDirection: string;
  cast: LessonImageBriefSubject[];
  settings: LessonImageBriefSubject[];
  parts: LessonImageBriefPart[];
  createdAt: string;
}

/** A structured text request that is not one of the stage templates. */
export interface LessonStructuredRequest {
  /** Schema name sent to the provider (letters, digits and underscores). */
  name: string;
  /** Short label for logs. */
  label: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

export interface LessonImageBriefSource {
  theme: string;
  biblicalReference: string;
  category: string;
  stage: string;
  /** Base rules + the administrator's own guidance for the item. */
  adminGuidance: string;
  story: string;
  memoryVerse: Record<string, unknown> | null;
  visualConfig: Record<string, unknown> | null;
  /** The item's content without its image list. */
  stageContent: Record<string, unknown>;
  plannedImages: Record<string, unknown>[];
}
