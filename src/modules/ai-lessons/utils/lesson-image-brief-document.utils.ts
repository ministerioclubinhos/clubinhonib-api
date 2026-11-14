import { IMAGE_BRIEF_LEAKED_HEADING } from '../constants/lesson-image-brief.constants';
import type { LessonJsonObject } from '../types/lesson-generation.types';

const headingLevel = (node: LessonJsonObject): number | null => {
  if (node.type !== 'heading') return null;
  const attrs = node.attrs as { level?: unknown } | undefined;
  return typeof attrs?.level === 'number' ? attrs.level : 1;
};

const nodeText = (node: LessonJsonObject): string =>
  Array.isArray(node.content)
    ? (node.content as LessonJsonObject[])
        .map((child) =>
          typeof child.text === 'string' ? child.text : nodeText(child),
        )
        .join('')
    : '';

/**
 * Removes the art director's brief from an editable document. It is server
 * bookkeeping for the image generator and never belongs to the material the
 * teacher reads, edits or prints.
 */
export function withoutLeakedImageBrief<T>(document: T): T {
  if (!document || typeof document !== 'object') return document;
  const doc = document as LessonJsonObject;
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return document;
  const nodes = doc.content as LessonJsonObject[];
  const start = nodes.findIndex(
    (node) =>
      headingLevel(node) !== null &&
      nodeText(node).trim().toLocaleUpperCase('pt-BR') ===
        IMAGE_BRIEF_LEAKED_HEADING,
  );
  if (start < 0) return document;
  const level = headingLevel(nodes[start]) ?? 1;
  const after = nodes.findIndex((node, index) => {
    const nodeLevel = headingLevel(node);
    return index > start && nodeLevel !== null && nodeLevel <= level;
  });
  return {
    ...doc,
    content: [
      ...nodes.slice(0, start),
      ...(after < 0 ? [] : nodes.slice(after)),
    ],
  } as T;
}
