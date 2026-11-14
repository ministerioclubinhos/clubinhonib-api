import {
  MARKDOWN_BOLD_PATTERN,
  MARKDOWN_STRAY_BOLD_MARKER,
} from '../constants/lesson-document.constants';
import type { LessonJsonObject } from '../types/lesson-generation.types';

/**
 * Tiptap text nodes for one generated line. Models sometimes emphasise labels
 * with Markdown (`**Para quem já crê em Jesus:**`); the editor and the PDF
 * would print the asterisks, so the span becomes a real bold mark and any
 * unmatched marker is dropped.
 */
export function lessonInlineTextNodes(text: string): LessonJsonObject[] {
  const nodes: LessonJsonObject[] = [];
  const push = (value: string, bold: boolean): void => {
    const clean = value.replace(MARKDOWN_STRAY_BOLD_MARKER, '');
    if (!clean) return;
    nodes.push(
      bold
        ? { type: 'text', text: clean, marks: [{ type: 'bold' }] }
        : { type: 'text', text: clean },
    );
  };
  let last = 0;
  for (const match of text.matchAll(MARKDOWN_BOLD_PATTERN)) {
    push(text.slice(last, match.index), false);
    push(match[1], true);
    last = match.index + match[0].length;
  }
  push(text.slice(last), false);
  return nodes.length > 0 ? nodes : [{ type: 'text', text }];
}
