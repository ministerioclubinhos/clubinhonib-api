import { ConflictException } from '@nestjs/common';
import { AppBusinessException, ErrorCode } from 'src/shared/exceptions';
import { LESSON_GAME_MAX_STEPS } from '../constants/ai-provider-settings.constants';
import {
  LESSON_INTERNAL_FIELDS,
  LESSON_SCENE_ID_DIGITS,
  LESSON_SCENE_ID_PREFIX,
  LESSON_NARRATIVE_INCOMPLETE_PREFIX,
} from '../constants/lesson-editorial.constants';
import {
  LESSON_CANONICAL_VERSE_VERSION,
  LESSON_GAME_STAGES,
  LESSON_MEDITATION_STAGES,
  LESSON_VISUAL_QUANTITY,
} from '../constants/lesson-workflow.constants';
import { LessonEntity } from '../entities/lesson.entity';
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
    if (steps.length > LESSON_GAME_MAX_STEPS)
      throw new ConflictException(
        `A brincadeira pode ter no máximo ${LESSON_GAME_MAX_STEPS} passos, cada um com seu visual instrucional.`,
      );
    const invalid =
      !steps.length ||
      assets.length !== steps.length ||
      assets.some(
        (asset, index) =>
          lessonString(asset.id).trim() !==
            `instrucao-${String(index + 1).padStart(2, '0')}` ||
          Number(asset.stepNumber) !== index + 1 ||
          lessonString(asset.instruction).trim() !== steps[index],
      );
    if (invalid)
      throw new ConflictException(
        'A brincadeira precisa ter exatamente um visual instrucional para cada passo, na mesma ordem e com a instrução literal.',
      );
  }

  if (LESSON_MEDITATION_STAGES.includes(type)) {
    generated.title = lesson.theme;
    if (type === LessonStageType.MEDITATION_OLDER)
      generated.biblicalText = lesson.biblicalReference;
  }
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
