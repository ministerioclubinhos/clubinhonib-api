import { ConflictException } from '@nestjs/common';
import { AppBusinessException, ErrorCode } from 'src/shared/exceptions';
import { LESSON_FUN_GAME_LIMITS } from '../constants/ai-provider-settings.constants';
import {
  LESSON_INTERNAL_FIELDS,
  LESSON_SCENE_ID_DIGITS,
  LESSON_SCENE_ID_PREFIX,
  LESSON_NARRATIVE_INCOMPLETE_PREFIX,
} from '../constants/lesson-editorial.constants';
import {
  LESSON_CANONICAL_VERSE_VERSION,
  LESSON_GAME_STAGES,
  LESSON_GAME_SUMMARY_ASSET_ID,
  LESSON_MEDITATION_STAGES,
  LESSON_VISUAL_QUANTITY,
} from '../constants/lesson-workflow.constants';
import { LessonEntity } from '../entities/lesson.entity';
import { withMissingActivityArt } from './meditation-assets.utils';
import { canonicalVerseFromLesson } from './lesson-verse.utils';
import {
  LessonCategory,
  LessonStageType,
  LessonVisualType,
} from '../enums/lesson.enums';
import { REGULAR_STORY_VISUAL_TYPES } from '../constants/lesson-visual-style.constants';
import { lessonNarrativeIssue } from '../lessonNarrative.utils';
import { resolveLessonVisualStyle } from './story-visual-mode.utils';
import type {
  LessonGenerationRequest,
  LessonJsonObject,
  LessonVisualConfig,
} from '../types/lesson-generation.types';
import { lessonString, normalizeLessonVerseReference } from '../utils';
import {
  markUnsupportedCutoutItemsAsExtra,
  normalizeCutoutKitStructure,
  repairCutoutStoryEvidence,
  validateCutoutKit,
} from './cutout-kit.utils';
import { lessonAsObject, lessonCurrentContent } from './lesson-workflow.utils';

export function validateVisualConfig(
  dto: Pick<
    LessonGenerationRequest,
    'visualType' | 'visualOrientation' | 'visualQuantity' | 'visualStyle'
  >,
  category?: LessonCategory | null,
): LessonVisualConfig {
  const isSpecial = category === LessonCategory.SPECIAL;
  const visualType =
    dto.visualType ?? (isSpecial ? undefined : LessonVisualType.CUTOUT_KIT);
  if (
    !visualType ||
    !dto.visualOrientation ||
    !dto.visualQuantity ||
    !Number.isInteger(dto.visualQuantity) ||
    dto.visualQuantity < LESSON_VISUAL_QUANTITY.MIN ||
    dto.visualQuantity > LESSON_VISUAL_QUANTITY.MAX
  )
    throw new AppBusinessException(
      ErrorCode.LESSON_INVALID_REQUEST,
      'Escolha o tipo pedagógico, a orientação e a quantidade de 4 a 10 imagens.',
    );
  if (!isSpecial && !REGULAR_STORY_VISUAL_TYPES.includes(visualType))
    throw new AppBusinessException(
      ErrorCode.LESSON_INVALID_REQUEST,
      'Na lição semanal, os visuais da história são um kit de recortes (CUTOUT_KIT) ou cenas completas (STORY_SEQUENCE).',
    );
  if (isSpecial && visualType === LessonVisualType.CUTOUT_KIT)
    throw new AppBusinessException(
      ErrorCode.LESSON_INVALID_REQUEST,
      'A Lição Especial mantém os cartazes de cena; escolha um tipo de cena.',
    );
  return {
    type: visualType,
    orientation: dto.visualOrientation,
    quantity: dto.visualQuantity,
    style: resolveLessonVisualStyle(dto.visualStyle),
  };
}

export function validateCanonicalContent(
  lesson: LessonEntity,
  type: LessonStageType,
  generated: LessonJsonObject,
  visualType?: string,
): LessonJsonObject {
  if (type === LessonStageType.LESSON) {
    for (const field of LESSON_INTERNAL_FIELDS) delete generated[field];
    const issue = lessonNarrativeIssue(generated.story);
    if (issue)
      throw new ConflictException(
        `${LESSON_NARRATIVE_INCOMPLETE_PREFIX}: ${issue}. Gere novamente para obter uma aula completa.`,
      );
    generated.biblicalReference = lesson.biblicalReference;
    const themeUpper = (lesson.theme ?? '').trim().toUpperCase();
    const titleStr = lessonString(generated.title).trim();
    if (
      themeUpper &&
      (!titleStr || !titleStr.toUpperCase().includes(themeUpper))
    ) {
      generated.title = `LIÇÃO: ${themeUpper}`;
    }
    const verse = lessonAsObject(generated.memoryVerse);
    verse.reference = normalizeLessonVerseReference(verse.reference);
    generated.memoryVerse = verse;
    if (
      !lessonString(verse.text).trim() ||
      !lessonString(verse.reference).trim() ||
      lessonString(verse.version).trim().toUpperCase() !==
        LESSON_CANONICAL_VERSE_VERSION
    ) {
      throw new ConflictException(
        'A lição precisa definir um único versículo principal, com texto, referência e versão NVI.',
      );
    }
    // Scene ids are internal (nothing else references them): renumbering in
    // order fixes "scene-1", "cena-01" or repeats instead of failing a paid
    // generation.
    if (Array.isArray(generated.visualScenes))
      generated.visualScenes = generated.visualScenes.map((item, index) => ({
        ...lessonAsObject(item),
        id: lessonSceneId(index),
      }));
  }

  if (
    type === LessonStageType.LESSON_VISUALS &&
    visualType === LessonVisualType.CUTOUT_KIT
  ) {
    const sourceStage = lesson.stages.find(
      (stage) => stage.type === LessonStageType.LESSON,
    );
    const source = sourceStage ? lessonCurrentContent(sourceStage) : null;
    // Elemento sem evidência na lição é um extra que a IA não marcou: corrige
    // aqui em vez de reprovar o kit inteiro por isso.
    const story = lessonString(source?.story).trim();
    // Antes de reprovar: citação que não confere vira a frase real da lição,
    // e elemento sem apoio no texto vira extra. Reprovar aqui custava duas
    // chamadas pagas e não entregava nada.
    normalizeCutoutKitStructure(generated);
    repairCutoutStoryEvidence(generated, story);
    markUnsupportedCutoutItemsAsExtra(generated);
    validateCutoutKit(generated, story);
  }

  if (
    type === LessonStageType.LESSON_VISUALS &&
    visualType !== LessonVisualType.CUTOUT_KIT
  ) {
    const sourceStage = lesson.stages.find(
      (stage) => stage.type === LessonStageType.LESSON,
    );
    const source = sourceStage ? lessonCurrentContent(sourceStage) : null;
    const completeStory = lessonString(source?.story).trim();
    const assets = Array.isArray(generated.assets)
      ? generated.assets.map((item) => lessonAsObject(item))
      : [];
    const assetIds = assets.map((asset) => lessonString(asset.id).trim());
    if (
      assetIds.some(
        (id, index) => id !== `visual-${String(index + 1).padStart(2, '0')}`,
      ) ||
      new Set(assetIds).size !== assetIds.length
    ) {
      throw new ConflictException(
        'Os visuais da história precisam usar IDs sequenciais no formato visual-01, visual-02 e assim por diante.',
      );
    }
    const normalize = (value: string): string =>
      value.trim().replace(/\s+/g, ' ');
    const reconstructedStory = assets
      .map((asset) => lessonString(asset.sourceExcerpt).trim())
      .filter(Boolean)
      .join(' ');
    if (
      !completeStory ||
      assets.some((asset) => !lessonString(asset.sourceExcerpt).trim()) ||
      normalize(reconstructedStory) !== normalize(completeStory)
    )
      throw new ConflictException(
        'A IA precisa dividir toda a LIÇÃO BÍBLICA entre os visuais, na ordem, sem omitir, repetir ou reescrever trechos.',
      );
  }

  if (LESSON_GAME_STAGES.includes(type)) {
    const steps = Array.isArray(generated.steps)
      ? generated.steps.map((step) => lessonString(step).trim())
      : [];
    const assets = Array.isArray(generated.assets)
      ? generated.assets.map((item) => lessonAsObject(item))
      : [];
    // Both fun games (item 3 and the verse fixation, item 5) are a one-page
    // document plus a single compiled image.
    const list = (value: unknown): unknown[] =>
      Array.isArray(value) ? value : [];
    if (
      steps.length > LESSON_FUN_GAME_LIMITS.maxSteps ||
      list(generated.materials).length > LESSON_FUN_GAME_LIMITS.maxMaterials ||
      list(generated.rulesAndSafety).length > LESSON_FUN_GAME_LIMITS.maxRules
    )
      throw new ConflictException(
        `A brincadeira divertida é um documento de uma página: no máximo ${LESSON_FUN_GAME_LIMITS.maxSteps} passos, ${LESSON_FUN_GAME_LIMITS.maxMaterials} materiais e ${LESSON_FUN_GAME_LIMITS.maxRules} regras.`,
      );
    if (
      !steps.length ||
      assets.length !== 1 ||
      lessonString(assets[0].id).trim() !== LESSON_GAME_SUMMARY_ASSET_ID
    )
      throw new ConflictException(
        'A brincadeira divertida precisa ter o passo a passo no documento e exatamente uma imagem com o compilado de toda a brincadeira.',
      );
    return generated;
  }

  if (LESSON_MEDITATION_STAGES.includes(type)) {
    generated.title = lesson.theme;
    // Meditations print the verse approved in the lesson, never their own.
    const verse = Array.isArray(lesson.stages)
      ? canonicalVerseFromLesson(lesson)
      : null;
    if (verse) {
      generated.verseText = verse.text;
      generated.verseReference = verse.reference;
      generated.verseVersion = verse.version;
    }
    if (
      type === LessonStageType.MEDITATION_OLDER &&
      !lessonString(generated.biblicalText).trim()
    )
      generated.biblicalText = lesson.biblicalReference;
  }
  if (type === LessonStageType.MEDITATION_YOUNGER)
    return withMissingActivityArt(generated);
  return generated;
}

export function isNewGame(
  previous: LessonJsonObject,
  candidate: LessonJsonObject,
): boolean {
  const normalize = (value: unknown): string =>
    lessonString(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const listSignature = (value: unknown): string =>
    Array.isArray(value)
      ? value.map(normalize).filter(Boolean).sort().join('|')
      : '';

  return (
    normalize(previous.name) !== normalize(candidate.name) &&
    listSignature(previous.funMechanics) !==
      listSignature(candidate.funMechanics) &&
    listSignature(previous.steps) !== listSignature(candidate.steps)
  );
}

export function isNewGameFromHistory(
  previousVariants: LessonJsonObject[],
  candidate: LessonJsonObject,
): boolean {
  return previousVariants.every((previous) => isNewGame(previous, candidate));
}

/** Stable internal id of the n-th visual scene (0-based): scene-01, scene-02… */
export function lessonSceneId(index: number): string {
  return `${LESSON_SCENE_ID_PREFIX}${String(index + 1).padStart(LESSON_SCENE_ID_DIGITS, '0')}`;
}
