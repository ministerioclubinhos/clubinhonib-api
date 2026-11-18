import { LESSON_VERSE_CHANGE } from '../constants/lesson-verse-change.constants';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import {
  getLessonStageOrder,
  LessonStageStatus,
  LessonStageType,
} from '../enums/lesson.enums';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import { lessonString } from '../utils';
import { lessonAsObject } from './lesson-workflow.utils';

export interface LessonVerseValue {
  text: string;
  reference: string;
  version: string;
}

const nodeText = (node: LessonJsonObject): string => {
  if (typeof node.text === 'string') return node.text;
  const children = Array.isArray(node.content)
    ? (node.content as LessonJsonObject[])
    : [];
  return children.map(nodeText).join('');
};

const isHeading = (node: LessonJsonObject): boolean => node.type === 'heading';

const headingLevel = (node: LessonJsonObject): number =>
  Number(lessonAsObject(node.attrs).level) || 1;

const paragraph = (text: string): LessonJsonObject => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

/**
 * The item 1 document with only the verse section rewritten. Everything else
 * (formatting, colors, edits by the admin) is kept; null when the document has
 * no verse section, so the caller can rebuild it from the structured content.
 */
export function replaceMemoryVerseInDocument(
  document: LessonJsonObject,
  verse: LessonVerseValue,
): LessonJsonObject | null {
  const nodes = Array.isArray(document.content)
    ? (document.content as LessonJsonObject[])
    : null;
  if (!nodes) return null;
  const start = nodes.findIndex(
    (node) =>
      isHeading(node) &&
      (LESSON_VERSE_CHANGE.SECTION_HEADINGS as readonly string[]).includes(
        nodeText(node).trim().toLocaleUpperCase('pt-BR'),
      ),
  );
  if (start < 0) return null;
  const level = headingLevel(nodes[start]);
  let end = start + 1;
  // The section ends at the next heading of the same or a higher level; legacy
  // sub-headings (one per verse part) are part of it and are replaced.
  while (
    end < nodes.length &&
    !(isHeading(nodes[end]) && headingLevel(nodes[end]) <= level)
  )
    end += 1;
  return {
    ...document,
    content: [
      ...nodes.slice(0, start + 1),
      paragraph(`“${verse.text}”`),
      paragraph(`${verse.reference} — ${verse.version}`),
      ...nodes.slice(end),
    ],
  };
}

/** The verse stored in the content of item 1, or null when it has none. */
export function currentMemoryVerse(
  content: LessonJsonObject | null,
): LessonVerseValue | null {
  const verse = lessonAsObject(content?.memoryVerse);
  const text = lessonString(verse.text).trim();
  const reference = lessonString(verse.reference).trim();
  return text || reference
    ? { text, reference, version: lessonString(verse.version).trim() }
    : null;
}

const normalizeForCompare = (value: string): string =>
  value
    .replace(/[“”"\s]+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');

export function isSameVerse(
  a: LessonVerseValue | null,
  b: LessonVerseValue,
): boolean {
  return (
    a !== null &&
    normalizeForCompare(a.text) === normalizeForCompare(b.text) &&
    normalizeForCompare(a.reference) === normalizeForCompare(b.reference)
  );
}

/** One line for the version history: what the verse was and what it became. */
export function lessonVerseChangeSummary(
  before: LessonVerseValue | null,
  after: LessonVerseValue,
): string {
  const text =
    before && before.reference && before.reference !== after.reference
      ? `${LESSON_VERSE_CHANGE.CHANGE_SUMMARY_PREFIX}: ${before.reference} → ${after.reference}`
      : `${LESSON_VERSE_CHANGE.CHANGE_SUMMARY_PREFIX}: texto de ${after.reference}`;
  return text.slice(0, 250);
}

/** Items after item 1 that already have content and will become outdated. */
export function stagesOutdatedByVerseChange(
  lesson: Pick<LessonEntity, 'category' | 'stages'>,
): LessonStageEntity[] {
  const order = getLessonStageOrder(lesson.category);
  return lesson.stages.filter(
    (stage) =>
      stage.type !== LessonStageType.LESSON &&
      order.indexOf(stage.type) > order.indexOf(LessonStageType.LESSON) &&
      stage.status !== LessonStageStatus.NOT_STARTED,
  );
}
