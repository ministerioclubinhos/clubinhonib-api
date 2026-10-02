import type { ISpacingProperties } from 'docx';

export interface LessonInlineExportOptions {
  size?: number;
  defaultColor?: string;
  defaultBold?: boolean;
  defaultItalic?: boolean;
  defaultFont?: string;
}

export type LessonDocumentSpacing = ISpacingProperties;
