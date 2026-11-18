import type { ISpacingProperties, Paragraph, Table } from 'docx';

export interface LessonInlineExportOptions {
  size?: number;
  defaultColor?: string;
  defaultBold?: boolean;
  defaultItalic?: boolean;
  defaultFont?: string;
}

export type LessonDocumentSpacing = ISpacingProperties;

export type LessonDocumentBlock = Paragraph | Table;

/** Downloads (once per document) the image behind a stored asset URL. */
export type LessonImageLoader = (url: string) => Promise<Buffer>;

export interface LessonAssetPageEntry {
  stage: Record<string, unknown>;
  /** Image-only pages print no step text or cutout legend. */
  imageOnly: boolean;
}

export interface LessonListContext {
  type: 'bullet' | 'ordered';
  depth: number;
  /** First number of an ordered list (`<ol start>`). */
  start?: number;
}
