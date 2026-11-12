import { lessonVisualStylePrompt } from './story-visual-mode.utils';
import { createHash } from 'node:crypto';
import {
  IMAGE_BRIEF_BASE_PROMPT,
  IMAGE_BRIEF_FIELD,
  IMAGE_BRIEF_PLAN_IGNORED_FIELDS,
  IMAGE_BRIEF_PROMPT_HEADINGS,
  LESSON_IMAGE_BRIEF,
  LESSON_IMAGE_BRIEF_SCHEMA,
  LESSON_IMAGE_BRIEF_SKIPPED_STAGES,
} from '../constants/lesson-image-brief.constants';
import { OWNED_ASSET_URLS_FIELD } from '../constants/lesson-asset.constants';
import { LessonImageBriefOrigin } from '../enums/lesson-image-brief.enum';
import { LessonStageType } from '../enums/lesson.enums';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import type {
  LessonImageBrief,
  LessonImageBriefPart,
  LessonImageBriefSource,
  LessonImageBriefSubject,
  LessonStructuredRequest,
} from '../types/lesson-image-brief.types';
import { lessonAssetListKey } from './lesson-studio-errors.utils';
import { lessonAsObject } from './lesson-workflow.utils';

const text = (value: unknown, max: number): string =>
  (typeof value === 'string' ? value.trim() : '').slice(0, max);

const sameName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');

export function imageBriefApplies(type: LessonStageType): boolean {
  return !LESSON_IMAGE_BRIEF_SKIPPED_STAGES.includes(type);
}

/** The images an item plans to draw, without what generating them produced. */
export function plannedImagesOf(
  type: LessonStageType,
  content: LessonJsonObject,
): LessonJsonObject[] {
  if (type === LessonStageType.LESSON) return [];
  const list = content[lessonAssetListKey(type)];
  return (Array.isArray(list) ? list : []).map((item) =>
    Object.fromEntries(
      Object.entries(lessonAsObject(item)).filter(
        ([key]) => !IMAGE_BRIEF_PLAN_IGNORED_FIELDS.includes(key),
      ),
    ),
  );
}

/** Same plan, same fingerprint: an edit to the planned images invalidates the brief. */
export function imagePlanFingerprint(planned: LessonJsonObject[]): string {
  return createHash('sha256').update(JSON.stringify(planned)).digest('hex');
}

function subjects(value: unknown): LessonImageBriefSubject[] {
  return (Array.isArray(value) ? value : [])
    .map((item) => lessonAsObject(item))
    .map((item) => ({
      name: text(item.name, 120),
      appearance: text(
        item.appearance,
        LESSON_IMAGE_BRIEF.MAX_APPEARANCE_LENGTH,
      ),
    }))
    .filter((item) => item.name && item.appearance)
    .slice(0, LESSON_IMAGE_BRIEF.MAX_SUBJECTS);
}

const namesIn = (
  value: unknown,
  known: readonly LessonImageBriefSubject[],
): string[] => [
  ...new Set(
    (Array.isArray(value) ? value : [])
      .map((name) => (typeof name === 'string' ? name : ''))
      .map((name) => known.find((item) => sameName(item.name, name))?.name)
      .filter((name): name is string => Boolean(name)),
  ),
];

/**
 * Turns the provider's answer into a brief. Returns the reason it cannot be
 * used instead of a half-usable brief: every planned image needs its part.
 */
export function parseImageBrief(
  raw: LessonJsonObject,
  planned: LessonJsonObject[],
  origin: LessonImageBriefOrigin,
  now: Date = new Date(),
): { brief: LessonImageBrief } | { problem: string } {
  const artDirection = text(
    raw.artDirection,
    LESSON_IMAGE_BRIEF.MAX_ART_DIRECTION_LENGTH,
  );
  if (!artDirection) return { problem: 'direção de arte vazia' };
  const cast = subjects(raw.cast);
  const settings = subjects(raw.settings);
  const answered = (Array.isArray(raw.parts) ? raw.parts : []).map((item) =>
    lessonAsObject(item),
  );
  const parts: LessonImageBriefPart[] = [];
  for (const asset of planned) {
    const assetId = String(asset.id);
    const found = answered.find((item) => String(item.assetId) === assetId);
    const prompt = text(found?.prompt, LESSON_IMAGE_BRIEF.MAX_PART_LENGTH);
    if (prompt.length < LESSON_IMAGE_BRIEF.MIN_PART_LENGTH)
      return { problem: `parte da imagem ${assetId} ausente ou vazia` };
    parts.push({
      assetId,
      prompt,
      cast: namesIn(found?.cast, cast),
      settings: namesIn(found?.settings, settings),
    });
  }
  return {
    brief: {
      version: LESSON_IMAGE_BRIEF.VERSION,
      origin,
      planFingerprint: imagePlanFingerprint(planned),
      artDirection,
      cast,
      settings,
      parts,
      createdAt: now.toISOString(),
    },
  };
}

/** The stored brief, when it still describes exactly the planned images. */
export function readImageBrief(
  type: LessonStageType,
  content: LessonJsonObject | null | undefined,
): LessonImageBrief | null {
  if (!content || !imageBriefApplies(type)) return null;
  const stored = lessonAsObject(content[IMAGE_BRIEF_FIELD]);
  if (stored.version !== LESSON_IMAGE_BRIEF.VERSION) return null;
  const planned = plannedImagesOf(type, content);
  if (planned.length === 0) return null;
  if (stored.planFingerprint !== imagePlanFingerprint(planned)) return null;
  const origin = Object.values(LessonImageBriefOrigin).find(
    (value) => value === stored.origin,
  );
  if (!origin) return null;
  const parsed = parseImageBrief(stored, planned, origin);
  if ('problem' in parsed) return null;
  return {
    ...parsed.brief,
    createdAt:
      typeof stored.createdAt === 'string'
        ? stored.createdAt
        : parsed.brief.createdAt,
  };
}

export function withImageBrief(
  content: LessonJsonObject,
  brief: LessonImageBrief,
): LessonJsonObject {
  return { ...content, [IMAGE_BRIEF_FIELD]: brief };
}

export function withoutImageBrief(content: LessonJsonObject): LessonJsonObject {
  return Object.fromEntries(
    Object.entries(content).filter(([key]) => key !== IMAGE_BRIEF_FIELD),
  );
}

/** What the art director reads: base rules + administrator + lesson + plan. */
export function buildImageBriefRequest(
  source: LessonImageBriefSource,
): LessonStructuredRequest {
  return {
    name: LESSON_IMAGE_BRIEF.SCHEMA_NAME,
    label: LESSON_IMAGE_BRIEF.LOG_LABEL,
    system: IMAGE_BRIEF_BASE_PROMPT,
    user: JSON.stringify({
      licao: {
        tema: source.theme,
        referenciaBiblica: source.biblicalReference,
        tipoDeMaterial: source.category,
        historia: source.story,
        versiculo: source.memoryVerse,
      },
      item: source.stage,
      orientacoesDoAdministrador: source.adminGuidance,
      configuracaoVisual: source.visualConfig,
      estiloDeDesenho:
        String(source.stage) === String(LessonStageType.LESSON_VISUALS)
          ? lessonVisualStylePrompt(source.visualConfig?.style)
          : null,
      conteudoDoItem: JSON.stringify(source.stageContent).slice(
        0,
        LESSON_IMAGE_BRIEF.MAX_STAGE_CONTENT_LENGTH,
      ),
      imagensPlanejadas: source.plannedImages,
    }),
    schema: LESSON_IMAGE_BRIEF_SCHEMA,
  };
}

/** The item's own content, without image lists and server bookkeeping. */
export function stageContentForBrief(
  type: LessonStageType,
  content: LessonJsonObject,
): LessonJsonObject {
  const hidden = [
    lessonAssetListKey(type),
    IMAGE_BRIEF_FIELD,
    OWNED_ASSET_URLS_FIELD,
  ];
  return Object.fromEntries(
    Object.entries(content).filter(([key]) => !hidden.includes(key)),
  );
}

export function imageBriefPart(
  brief: LessonImageBrief | null,
  assetId: string,
): LessonImageBriefPart | null {
  return brief?.parts.find((part) => part.assetId === assetId) ?? null;
}

const sheet = (
  heading: string,
  names: readonly string[],
  known: readonly LessonImageBriefSubject[],
): string[] => {
  const lines = names
    .map((name) => known.find((item) => item.name === name))
    .filter((item): item is LessonImageBriefSubject => Boolean(item))
    .map((item) => `- ${item.name}: ${item.appearance}`);
  return lines.length ? [heading, lines.join('\n')] : [];
};

/**
 * The prompt of one image: the stage rules that already existed, followed by
 * the art direction shared by the whole set and by this image's own part.
 */
export function withImageBriefPart(
  prompt: string,
  brief: LessonImageBrief | null,
  assetId: string,
): string {
  const part = imageBriefPart(brief, assetId);
  if (!brief || !part) return prompt;
  return [
    prompt,
    IMAGE_BRIEF_PROMPT_HEADINGS.artDirection,
    brief.artDirection,
    ...sheet(IMAGE_BRIEF_PROMPT_HEADINGS.cast, part.cast, brief.cast),
    ...sheet(
      IMAGE_BRIEF_PROMPT_HEADINGS.settings,
      part.settings,
      brief.settings,
    ),
    IMAGE_BRIEF_PROMPT_HEADINGS.part,
    part.prompt,
  ].join('\n\n');
}
