import type { CanonicalSectionKind } from '../enums/lesson-canonical-content.enums';

export interface CanonicalSectionField {
  /** Key inside `structuredDataJson`. */
  key: string;
  /** Headings (first is canonical) that open this section in the editor. */
  headings: readonly string[];
  kind: CanonicalSectionKind;
}

export type CanonicalJsonObject = Record<string, unknown>;

export interface ExtractedTiptapSection {
  present: boolean;
  text: string;
  nodes: CanonicalJsonObject[];
}

export interface LessonMemoryVerse {
  text: string;
  reference: string;
  version: string;
}

export interface LessonReviewQuestion {
  question: string;
  answer: string;
}
