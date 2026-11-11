import { ConflictException } from '@nestjs/common';
import {
  BIBLE_REFERENCE_PATTERN,
  BIBLE_VERSION_PATTERN,
  CANONICAL_TABLE_CELL_SEPARATOR,
  GAME_AGE_ADAPTATIONS_HEADINGS,
  GAME_AGE_ADAPTATIONS_KEY,
  GAME_AGE_ADAPTATION_SECTIONS,
  GAME_CANONICAL_SECTIONS,
  GAME_MAX_DURATION_MINUTES,
  LESSON_CANONICAL_SECTIONS,
  LESSON_REQUIRED_BIBLE_VERSION,
  LESSON_VERSE_SUBHEADINGS,
  SERVER_AUTHORITATIVE_STAGES,
} from '../constants/lesson-canonical-content.constants';
import { LESSON_ASSET_LIST_FIELDS } from '../constants/lesson-asset.constants';
import { LESSON_NARRATIVE_INCOMPLETE_PREFIX } from '../constants/lesson-editorial.constants';
import { CanonicalSectionKind } from '../enums/lesson-canonical-content.enums';
import { LessonStageType } from '../enums/lesson.enums';
import { lessonNarrativeIssue } from '../lessonNarrative.utils';
import type {
  CanonicalJsonObject as JsonObject,
  CanonicalSectionField,
  ExtractedTiptapSection,
  LessonMemoryVerse,
  LessonReviewQuestion,
} from '../types/lesson-canonical-content.types';
import { lessonString, normalizeLessonVerseReference } from '../utils';
import { preserveServerOwnedAssetsOnManualSave } from './lesson-asset-ownership.utils';
import { editedOlderMeditation } from './older-meditation-content.utils';
import { editedYoungerMeditation } from './younger-meditation-content.utils';

const LIST_NODE_TYPES = ['bulletList', 'orderedList', 'listItem'];
const TABLE_CELL_NODE_TYPES = ['tableCell', 'tableHeader'];

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function childNodes(node: JsonObject): JsonObject[] {
  return Array.isArray(node.content)
    ? node.content.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}

/** Flattens a node to text keeping list items, table rows and cells apart. */
export function tiptapNodeText(node: JsonObject): string {
  if (node.type === 'hardBreak') return '\n';
  const type = lessonString(node.type);
  const ownText = lessonString(node.text);
  const children = childNodes(node).map(tiptapNodeText);
  if (type === 'tableRow')
    return children
      .map((cell) => cell.trim())
      .join(CANONICAL_TABLE_CELL_SEPARATOR);
  if (TABLE_CELL_NODE_TYPES.includes(type))
    return children.filter(Boolean).join(' ');
  const separator =
    LIST_NODE_TYPES.includes(type) || type === 'table' ? '\n' : '';
  return [ownText, ...children].filter(Boolean).join(separator);
}

/** Case-, accent- and punctuation-insensitive key ("Aplicação & Apelo" ≡ "APLICAÇÃO E APELO"). */
export function normalizeHeading(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' E ')
    .toLocaleUpperCase('pt-BR')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function headingLevel(node: JsonObject): number {
  return Number(asObject(node.attrs).level ?? 2);
}

function isHeading(node: JsonObject): boolean {
  return node.type === 'heading';
}

/**
 * Label the generator gives to a structured key it has no translation for;
 * such headings also delimit sections (see `LessonDraftService.toTiptap`).
 */
function genericKeyHeading(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
}

function recognizedHeadingSet(
  fields: readonly CanonicalSectionField[],
  base: JsonObject,
  extraHeadings: readonly string[] = [],
): Set<string> {
  return new Set(
    [
      ...fields.flatMap((field) => field.headings),
      ...extraHeadings,
      ...Object.keys(base)
        .filter((key) => !key.startsWith('_'))
        .map(genericKeyHeading),
    ].map(normalizeHeading),
  );
}

/**
 * Returns the nodes between a section heading and the next section.
 *
 * When `recognizedHeadings` is given, only a recognised section heading (or a
 * level-1 title) ends the section, so a free sub-heading typed inside the
 * narrative no longer truncates it. Without it, the legacy rule applies: any
 * heading of the same or higher level ends the section.
 */
export function extractTiptapSection(
  document: JsonObject,
  headingCandidates: readonly string[],
  recognizedHeadings?: ReadonlySet<string>,
): ExtractedTiptapSection {
  const nodes = childNodes(document);
  const normalizedCandidates = headingCandidates.map(normalizeHeading);
  const start = nodes.findIndex(
    (node) =>
      isHeading(node) &&
      normalizedCandidates.includes(normalizeHeading(tiptapNodeText(node))),
  );
  if (start < 0) {
    return { present: false, text: '', nodes: [] };
  }

  const startLevel = headingLevel(nodes[start]);
  const remaining = nodes.slice(start + 1);
  const end = remaining.findIndex((node) => {
    if (!isHeading(node)) return false;
    if (!recognizedHeadings) return headingLevel(node) <= startLevel;
    return (
      headingLevel(node) === 1 ||
      recognizedHeadings.has(normalizeHeading(tiptapNodeText(node)))
    );
  });
  const sectionNodes = end < 0 ? remaining : remaining.slice(0, end);
  const text = sectionNodes
    .map((node) => {
      const nodeText = tiptapNodeText(node).trim();
      return isHeading(node) && nodeText ? `### ${nodeText}` : nodeText;
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return { present: true, text, nodes: sectionNodes };
}

function stripListMarker(value: string): string {
  return value
    .trim()
    .replace(/^(?:•|\d+[.)])\s*/, '')
    .trim();
}

function extractListItemsFromSection(
  section: ExtractedTiptapSection,
): string[] {
  const items: string[] = [];
  for (const node of section.nodes) {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      for (const child of childNodes(node)) {
        const text = stripListMarker(tiptapNodeText(child));
        if (text) items.push(text);
      }
    } else if (node.type === 'paragraph') {
      items.push(
        ...tiptapNodeText(node)
          .split(/\r?\n/)
          .map(stripListMarker)
          .filter(Boolean),
      );
    }
  }
  return items;
}

function stripQuotes(value: string): string {
  return value
    .trim()
    .replace(/^[“"«]+/, '')
    .replace(/[”"»]+$/, '')
    .trim();
}

export function isBibleReference(value: string): boolean {
  return BIBLE_REFERENCE_PATTERN.test(value.trim());
}

function versionToken(value: string): string | null {
  return value.trim().match(BIBLE_VERSION_PATTERN)?.[1] ?? null;
}

/** Legacy editor layout: one sub-heading per verse part. */
function parseVerseSubheadings(
  section: ExtractedTiptapSection,
  previousVerse: JsonObject,
): LessonMemoryVerse | null {
  const parts: Record<keyof typeof LESSON_VERSE_SUBHEADINGS, string[]> = {
    text: [],
    reference: [],
    version: [],
  };
  let current: keyof typeof LESSON_VERSE_SUBHEADINGS | null = null;
  let found = false;
  for (const node of section.nodes) {
    if (isHeading(node)) {
      const heading = normalizeHeading(tiptapNodeText(node));
      const match = (
        Object.keys(LESSON_VERSE_SUBHEADINGS) as Array<
          keyof typeof LESSON_VERSE_SUBHEADINGS
        >
      ).find((key) =>
        LESSON_VERSE_SUBHEADINGS[key].map(normalizeHeading).includes(heading),
      );
      current = match ?? null;
      found = found || Boolean(match);
      continue;
    }
    const text = tiptapNodeText(node).trim();
    if (current && text) parts[current].push(text);
  }
  if (!found) return null;
  return {
    text: stripQuotes(parts.text.join(' ')),
    reference: normalizeLessonVerseReference(parts.reference.join(' ')),
    version:
      parts.version.join(' ').trim() ||
      lessonString(previousVerse.version).trim() ||
      LESSON_REQUIRED_BIBLE_VERSION,
  };
}

/**
 * Reads "text / reference — version" in any of the editor layouts:
 * several paragraphs of verse followed by a reference line, a single line
 * `“text” — Reference — NVI`, or `“text” (Reference - NVI)`. The reference is
 * always the LAST segment that looks like one, so a dash or a second paragraph
 * inside the verse stays part of the verse.
 */
export function parseLessonMemoryVerseSection(
  section: ExtractedTiptapSection,
  previousVerse: JsonObject,
): LessonMemoryVerse {
  const subheadings = parseVerseSubheadings(section, previousVerse);
  if (subheadings) return subheadings;

  const previousVersion =
    lessonString(previousVerse.version).trim() || LESSON_REQUIRED_BIBLE_VERSION;
  const lines = section.text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { text: '', reference: '', version: '' };
  }

  // `“text” (Reference - NVI)` or `“text” (Reference)` closing the section.
  const parenthetical = lines.join(' ').match(/^(.*?)\s*\(([^()]+)\)\s*$/s);
  if (parenthetical) {
    const inner = parenthetical[2].trim();
    const innerVersion = inner.match(/\s*[-–—,]?\s*(\p{Lu}{2,5})$/u);
    const innerReference = normalizeLessonVerseReference(
      innerVersion ? inner.slice(0, innerVersion.index).trim() : inner,
    );
    if (parenthetical[1].trim() && isBibleReference(innerReference)) {
      return {
        text: stripQuotes(parenthetical[1]),
        reference: innerReference,
        version: innerVersion?.[1] ?? previousVersion,
      };
    }
  }

  // Segments keep the separator that preceded them so the verse is rebuilt verbatim.
  const segments: Array<{ value: string; separator: string }> = [];
  lines.forEach((line, lineIndex) => {
    const pieces = line.split(/(\s+[—–-]\s+|\s*—\s*)/);
    for (let index = 0; index < pieces.length; index += 2) {
      const value = pieces[index].trim();
      if (!value) continue;
      segments.push({
        value,
        separator: index === 0 ? (lineIndex === 0 ? '' : ' ') : ' — ',
      });
    }
  });

  let version = previousVersion;
  const last = segments[segments.length - 1];
  const trailingVersion = last ? versionToken(last.value) : null;
  if (trailingVersion && segments.length > 1) {
    version = trailingVersion;
    segments.pop();
  }

  const joinSegments = (
    items: Array<{ value: string; separator: string }>,
  ): string =>
    items
      .map((segment, index) =>
        index === 0 ? segment.value : `${segment.separator}${segment.value}`,
      )
      .join('');

  const candidate = segments[segments.length - 1];
  const candidateReference = candidate
    ? normalizeLessonVerseReference(candidate.value)
    : '';
  if (segments.length >= 2 && isBibleReference(candidateReference)) {
    return {
      text: stripQuotes(joinSegments(segments.slice(0, -1))),
      reference: candidateReference,
      version,
    };
  }

  if (segments.length === 1) {
    // Only the verse was typed: the reference stays the one already approved.
    return {
      text: stripQuotes(segments[0].value),
      reference: normalizeLessonVerseReference(previousVerse.reference),
      version,
    };
  }

  // Several segments and none is a reference: keep the whole text and leave
  // the reference empty so completion fails with a specific message.
  return { text: stripQuotes(joinSegments(segments)), reference: '', version };
}

/**
 * Numbered lines open a question; "Resposta:" opens its answer, on its own
 * line or after the question on the same line. Unnumbered lines continue the
 * answer (or the question) unless they are themselves a question.
 */
export function parseReviewQuestionsSection(
  section: ExtractedTiptapSection,
): LessonReviewQuestion[] {
  const lines = section.text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const questions: LessonReviewQuestion[] = [];
  let answering = false;
  for (const line of lines) {
    const numbered = /^\d+[.)]\s*/.test(line);
    const body = line.replace(/^\d+[.)]\s*/, '').trim();
    const answerOnly = body.match(/^resposta\s*:\s*(.*)$/is);
    const current = questions[questions.length - 1];
    if (answerOnly && !numbered) {
      if (current) {
        current.answer = [current.answer, answerOnly[1].trim()]
          .filter(Boolean)
          .join('\n');
        answering = true;
      }
      continue;
    }
    const startsQuestion =
      numbered ||
      !current ||
      (answering ? /\?\s*$/.test(body) : /\?\s*$/.test(current.question));
    if (!startsQuestion) {
      if (answering)
        current.answer = [current.answer, body].filter(Boolean).join('\n');
      else current.question = `${current.question} ${body}`.trim();
      continue;
    }
    const inline = body.match(/^(.*?)\s+resposta\s*:\s*(.*)$/is);
    const question = (inline ? inline[1] : body).trim();
    if (!question) continue;
    questions.push({ question, answer: inline ? inline[2].trim() : '' });
    answering = Boolean(inline);
  }
  return questions;
}

function extractLessonTitleFromAst(document: JsonObject): string | undefined {
  const nonMarker = childNodes(document)
    .filter(
      (node) =>
        isHeading(node) && Number(asObject(node.attrs).level ?? 1) === 1,
    )
    .map((node) => tiptapNodeText(node).trim())
    .filter(
      (text) =>
        Boolean(text) &&
        !/^LIÇÃO(?:\s+ESPECIAL)?(?:\s+\d+)?$/i.test(text) &&
        !/^TÍTULO$/i.test(text),
    );
  return nonMarker[0];
}

function emptyValue(field: CanonicalSectionField, previous: unknown): unknown {
  switch (field.kind) {
    case CanonicalSectionKind.LIST:
    case CanonicalSectionKind.QUESTIONS:
      return [];
    case CanonicalSectionKind.TEXT_OR_LIST:
      return Array.isArray(previous) ? [] : '';
    case CanonicalSectionKind.VERSE:
      return { text: '', reference: '', version: '' };
    case CanonicalSectionKind.NUMBER:
      return previous;
    default:
      return '';
  }
}

function sectionValue(
  field: CanonicalSectionField,
  section: ExtractedTiptapSection,
  previous: unknown,
): unknown {
  switch (field.kind) {
    case CanonicalSectionKind.LIST:
      return extractListItemsFromSection(section);
    case CanonicalSectionKind.TEXT_OR_LIST:
      return Array.isArray(previous)
        ? extractListItemsFromSection(section)
        : section.text;
    case CanonicalSectionKind.VERSE:
      return parseLessonMemoryVerseSection(section, asObject(previous));
    case CanonicalSectionKind.QUESTIONS:
      return parseReviewQuestionsSection(section);
    case CanonicalSectionKind.NUMBER: {
      const parsed = Number(section.text.match(/\d+/)?.[0]);
      return Number.isInteger(parsed) &&
        parsed > 0 &&
        parsed <= GAME_MAX_DURATION_MINUTES
        ? parsed
        : previous;
    }
    default:
      return section.text;
  }
}

/**
 * Applies every known editor section onto `target`. A section whose heading
 * was removed is emptied (when the server stores that field) so the PDF, which
 * follows the edited document, and the derived stages, which follow the
 * structured data, cannot diverge.
 */
function applySections(
  target: JsonObject,
  document: JsonObject,
  fields: readonly CanonicalSectionField[],
  recognized: ReadonlySet<string>,
  clearMissing: boolean,
): void {
  for (const field of fields) {
    const section = extractTiptapSection(document, field.headings, recognized);
    if (section.present) {
      target[field.key] = sectionValue(field, section, target[field.key]);
    } else if (clearMissing && field.key in target) {
      target[field.key] = emptyValue(field, target[field.key]);
    }
  }
}

function hasRecognizedSection(
  document: JsonObject,
  fields: readonly CanonicalSectionField[],
): boolean {
  const known = new Set(
    fields.flatMap((field) => field.headings).map(normalizeHeading),
  );
  return childNodes(document).some(
    (node) =>
      isHeading(node) && known.has(normalizeHeading(tiptapNodeText(node))),
  );
}

function reconcileLessonStructuredContent(
  base: JsonObject,
  document: JsonObject,
): JsonObject {
  const next: JsonObject = { ...base };
  const editedTitle = extractLessonTitleFromAst(document);
  if (editedTitle !== undefined) next.title = editedTitle;
  applySections(
    next,
    document,
    LESSON_CANONICAL_SECTIONS,
    recognizedHeadingSet(LESSON_CANONICAL_SECTIONS, base),
    hasRecognizedSection(document, LESSON_CANONICAL_SECTIONS),
  );
  return next;
}

function reconcileGameStructuredContent(
  base: JsonObject,
  document: JsonObject,
): JsonObject {
  const next: JsonObject = { ...base };
  const allFields = [
    ...GAME_CANONICAL_SECTIONS,
    ...GAME_AGE_ADAPTATION_SECTIONS,
  ];
  const recognized = recognizedHeadingSet(
    allFields,
    base,
    GAME_AGE_ADAPTATIONS_HEADINGS,
  );
  const clearMissing = hasRecognizedSection(document, allFields);

  if ('title' in next) {
    const editedTitle = extractLessonTitleFromAst(document);
    if (editedTitle !== undefined) next.title = editedTitle;
  }
  applySections(
    next,
    document,
    GAME_CANONICAL_SECTIONS,
    recognized,
    clearMissing,
  );

  const steps = Array.isArray(next.steps)
    ? next.steps.map((step) => lessonString(step))
    : [];
  if (Array.isArray(next.assets) && steps.length === next.assets.length) {
    next.assets = (next.assets as unknown[]).map((raw, index) => ({
      ...asObject(raw),
      stepNumber: index + 1,
      instruction: steps[index],
    }));
  }

  const hasAdaptations = GAME_AGE_ADAPTATIONS_KEY in next;
  const adaptations: JsonObject = {
    ...asObject(next[GAME_AGE_ADAPTATIONS_KEY]),
  };
  const anyAdaptationSection = GAME_AGE_ADAPTATION_SECTIONS.some(
    (field) =>
      extractTiptapSection(document, field.headings, recognized).present,
  );
  if (anyAdaptationSection || (hasAdaptations && clearMissing)) {
    applySections(
      adaptations,
      document,
      GAME_AGE_ADAPTATION_SECTIONS,
      recognized,
      clearMissing,
    );
    next[GAME_AGE_ADAPTATIONS_KEY] = adaptations;
  }

  return next;
}

/**
 * Builds the canonical structured data of a manual edit.
 *
 * The server's current structured data is the only base: the client echo
 * (`_candidateStructured`) is ignored, so a request cannot inject, replace or
 * erase structured keys. Only fields derived from the edited document change.
 * Items 2, 4 and 8 have no editable structured field and stay as generated.
 */
export function reconcileStageStructuredContent(
  stageType: LessonStageType,
  currentStructured: JsonObject | null | undefined,
  _candidateStructured: JsonObject | null | undefined,
  tiptapAstJson: JsonObject | null | undefined,
): JsonObject {
  const server = asObject(currentStructured);
  const safeBase = preserveServerOwnedAssetsOnManualSave(server, { ...server });
  const document =
    tiptapAstJson &&
    typeof tiptapAstJson === 'object' &&
    !Array.isArray(tiptapAstJson)
      ? tiptapAstJson
      : null;
  if (!document || SERVER_AUTHORITATIVE_STAGES.includes(stageType)) {
    return safeBase;
  }

  if (stageType === LessonStageType.LESSON) {
    return reconcileLessonStructuredContent(safeBase, document);
  }

  if (
    stageType === LessonStageType.STANDARD_GAME ||
    stageType === LessonStageType.VERSE_FIXATION
  ) {
    return reconcileGameStructuredContent(safeBase, document);
  }

  if (stageType === LessonStageType.MEDITATION_YOUNGER) {
    return preserveServerOwnedAssetsOnManualSave(
      server,
      editedYoungerMeditation(safeBase, document),
    );
  }

  if (stageType === LessonStageType.MEDITATION_OLDER) {
    return preserveServerOwnedAssetsOnManualSave(
      server,
      editedOlderMeditation(safeBase, document),
    );
  }

  return safeBase;
}

function assetList(structured: JsonObject, key: string): JsonObject[] {
  return Array.isArray(structured[key])
    ? (structured[key] as unknown[]).map(asObject)
    : [];
}

function hasDocumentContent(document: JsonObject | null | undefined): boolean {
  return Boolean(document) && childNodes(asObject(document)).length > 0;
}

function assertLessonReady(canonical: JsonObject): void {
  const story = lessonString(canonical.story).trim();
  if (!story) {
    throw new ConflictException(
      'A lição não pode ser concluída ou publicada com o tópico LIÇÃO BÍBLICA vazio.',
    );
  }
  const narrativeIssue = lessonNarrativeIssue(story);
  if (narrativeIssue) {
    throw new ConflictException(
      `${LESSON_NARRATIVE_INCOMPLETE_PREFIX}: ${narrativeIssue}. Revise o texto antes de concluir.`,
    );
  }
  const verse = asObject(canonical.memoryVerse);
  const reference = lessonString(verse.reference).trim();
  if (lessonString(verse.text).trim() && !reference) {
    throw new ConflictException(
      'Não foi possível identificar a referência do versículo principal. Escreva a referência em uma linha própria, no formato Livro capítulo:versículo (ex.: João 3:16), seguida de — NVI.',
    );
  }
  if (
    !lessonString(verse.text).trim() ||
    !reference ||
    lessonString(verse.version).trim().toUpperCase() !==
      LESSON_REQUIRED_BIBLE_VERSION
  ) {
    throw new ConflictException(
      'A lição precisa manter o versículo principal com texto, referência e versão NVI antes de concluir.',
    );
  }
  if (!isBibleReference(reference)) {
    throw new ConflictException(
      `A referência do versículo principal ("${reference}") não está no formato Livro capítulo:versículo (ex.: João 3:16). Corrija o tópico VERSÍCULO PARA MEMORIZAR antes de concluir.`,
    );
  }
}

function assertGameReady(canonical: JsonObject): void {
  const steps = Array.isArray(canonical.steps)
    ? canonical.steps.map((step) => lessonString(step).trim()).filter(Boolean)
    : [];
  const assets = assetList(canonical, 'assets');
  if (steps.length === 0) {
    throw new ConflictException(
      'A brincadeira precisa manter ao menos um passo no PASSO A PASSO.',
    );
  }
  if (assets.length > 0 && steps.length !== assets.length) {
    throw new ConflictException(
      'A quantidade de passos do texto editado não corresponde às imagens instrucionais geradas. Ajuste os passos ou gere a etapa novamente.',
    );
  }
  if (
    assets.some(
      (asset, index) =>
        !lessonString(asset.url).trim() ||
        lessonString(asset.instruction).trim() !== steps[index],
    )
  ) {
    throw new ConflictException(
      'Cada passo da brincadeira precisa corresponder exatamente à sua imagem instrucional.',
    );
  }
}

function assertImagesReady(
  canonical: JsonObject,
  key: (typeof LESSON_ASSET_LIST_FIELDS)[number],
  message: string,
): void {
  const assets = assetList(canonical, key);
  if (
    assets.length === 0 ||
    assets.some((asset) => !lessonString(asset.url).trim())
  ) {
    throw new ConflictException(message);
  }
}

/**
 * Required content per stage. The rules do not depend on which keys happen to
 * be present: a version without the required field is not ready.
 */
export function assertStageReadyForCompletionOrPublication(
  stageType: LessonStageType,
  structuredDataJson: JsonObject | null | undefined,
  tiptapAstJson?: JsonObject | null,
): void {
  const raw = asObject(structuredDataJson);
  const hasRichPayload = Object.keys(raw).length > 0 || Boolean(tiptapAstJson);
  if (!hasRichPayload) return;

  const canonical = reconcileStageStructuredContent(
    stageType,
    raw,
    raw,
    tiptapAstJson ?? null,
  );

  switch (stageType) {
    case LessonStageType.LESSON:
      assertLessonReady(canonical);
      return;
    case LessonStageType.STANDARD_GAME:
    case LessonStageType.VERSE_FIXATION:
      assertGameReady(canonical);
      return;
    case LessonStageType.LESSON_VISUALS:
      assertImagesReady(
        canonical,
        'assets',
        'Os visuais da história precisam conter imagens válidas antes da conclusão ou publicação.',
      );
      return;
    case LessonStageType.VERSE_VISUALS:
    case LessonStageType.MANUAL_WORK:
      assertImagesReady(
        canonical,
        'printableAssets',
        'Este item precisa conter todas as artes imprimíveis válidas antes da conclusão ou publicação.',
      );
      return;
    case LessonStageType.MEDITATION_YOUNGER:
    case LessonStageType.MEDITATION_OLDER: {
      const activities = assetList(canonical, 'activities');
      // Legacy free-form meditations have no structured activities and are
      // exported straight from their document.
      if (!Array.isArray(raw.activities) && hasDocumentContent(tiptapAstJson)) {
        return;
      }
      if (
        activities.length === 0 ||
        activities.some(
          (activity) => !lessonString(activity.instruction).trim(),
        )
      ) {
        throw new ConflictException(
          'Todas as atividades da meditação precisam manter instruções preenchidas.',
        );
      }
      return;
    }
    default:
      return;
  }
}
