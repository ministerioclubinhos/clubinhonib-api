import { OLDER_MEDITATION_REVIEW_PROMPT } from '../constants/older-meditation-contract.constants';
import {
  LESSON_GAME_STAGES,
  LESSON_PROMPT_LIMITS,
  LESSON_SYSTEM_PROMPT as P,
  LESSON_VERSE_PRODUCT_STAGES,
} from '../constants/lesson-system-prompt.constants';
import { cutoutKitPromptRules } from '../constants/story-visual-quality.constants';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';
import { OlderMeditationReviewPhase } from '../enums/older-meditation.enums';
import { LessonLlmGenerationInput } from '../providers/lesson-llm.types';
import { serializeTemplate } from '../templates/lesson-templates';
import { getLessonTemplate } from '../templates/special-lesson-templates';
import {
  isCutoutKitVisuals,
  lessonVisualStylePrompt,
} from './story-visual-mode.utils';

/**
 * System prompt shared by OpenAI and Gemini. Only the rules of the requested
 * stage are sent; the independent item-7 review receives its own prompt with
 * none of the authoring rules.
 */
export function buildLessonSystemPrompt(
  input: LessonLlmGenerationInput,
): string {
  if (input.structuredRequest) return input.structuredRequest.system;
  if (input.olderMeditationReview)
    return [
      OLDER_MEDITATION_REVIEW_PROMPT,
      P.nvi,
      P.inputIsData,
      P.reviewOutput,
    ].join('\n\n');
  const special = input.category === LessonCategory.SPECIAL;
  const stage = input.stage;
  return [
    P.role,
    P.templateContract,
    serializeTemplate(
      special ? getLessonTemplate(stage, input.category) : input.template,
    ),
    P.archive,
    P.singleProduct,
    P.adminPrompt,
    P.inputIsData,
    stage === LessonStageType.LESSON ? P.nviLesson : P.nvi,
    P.narrative,
    ...(stage === LessonStageType.LESSON_VISUALS
      ? [
          P.storyVisualsSource,
          isCutoutKitVisuals(input.category, input.visualConfig?.type)
            ? cutoutKitPromptRules(
                input.visualConfig?.quantity ??
                  LESSON_PROMPT_LIMITS.cutoutDefaultQuantity,
              )
            : P.storyVisualsSpecial,
          `${P.visualStyleHeading}\n${lessonVisualStylePrompt(input.visualConfig?.style)}`,
        ]
      : []),
    ...(LESSON_GAME_STAGES.includes(stage)
      ? [
          stage === LessonStageType.STANDARD_GAME
            ? P.standardGameAsset
            : P.gameAssets,
          stage === LessonStageType.STANDARD_GAME
            ? P.standardGameFun
            : P.gameFun,
          P.gameHistory,
        ]
      : []),
    ...(stage === LessonStageType.VERSE_VISUALS
      ? [P.verseVisualsSplit, P.verseVisualsCard]
      : []),
    ...(LESSON_VERSE_PRODUCT_STAGES.includes(stage) ? [P.verseProducts] : []),
    ...(input.visualConfig ? [P.visualConfig] : []),
    ...(input.adminPrompt.trim()
      ? [`${P.editorialPromptHeading}\n${input.adminPrompt.trim()}`]
      : []),
    ...(stage === LessonStageType.LESSON && input.editorialPurpose?.trim()
      ? [`${P.editorialPurposeHeading}\n${input.editorialPurpose.trim()}`]
      : []),
    // Last, so the request-specific guidance is the freshest instruction.
    ...(input.revisionInstructions?.trim()
      ? [
          `${P.revisionInstructionsHeading}\n${input.revisionInstructions.trim()}`,
        ]
      : []),
    P.output,
  ].join('\n\n');
}

/**
 * Every previous name stays visible (names are the hard uniqueness rule), but
 * only the most recent variants keep their full description.
 */
export function boundedPreviousVariants(
  variants: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const detailedFrom = variants.length - LESSON_PROMPT_LIMITS.previousVariants;
  return variants.map((variant, index) =>
    index >= detailedFrom ? variant : { name: variant.name },
  );
}

/** User payload shared by both providers; history is capped to bound prompt growth. */
export function buildLessonUserPayload(
  input: LessonLlmGenerationInput,
): string {
  if (input.structuredRequest) return input.structuredRequest.user;
  return JSON.stringify({
    ...(input.olderMeditationReview
      ? {
          worksheetToReview: input.olderMeditationReview.content,
          reviewPhase: input.olderMeditationReview.images.length
            ? OlderMeditationReviewPhase.IMAGES
            : OlderMeditationReviewPhase.TEXT,
        }
      : {}),
    theme: input.theme,
    biblicalReference: input.biblicalReference,
    weekNumber: input.weekNumber,
    category: input.category ?? LessonCategory.REGULAR,
    specialContext: input.specialContext ?? null,
    stage: input.stage,
    approvedUpstream: input.approvedUpstream,
    previousVariants: boundedPreviousVariants(input.previousVariants ?? []),
    canonicalVerse: input.canonicalVerse ?? null,
    visualConfig: input.visualConfig ?? null,
    // Authoring guidance travels in the system prompt; only the independent
    // review keeps its instructions here, next to the sheet it checks.
    ...(input.olderMeditationReview
      ? { revisionInstructions: input.revisionInstructions ?? null }
      : {}),
  });
}

export function lessonOperationLabel(input: LessonLlmGenerationInput): string {
  if (input.structuredRequest) return input.structuredRequest.label;
  if (input.olderMeditationReview)
    return input.olderMeditationReview.images.length
      ? 'revisão de imagens'
      : 'revisão textual';
  return input.revisionInstructions
    ? 'geração com instruções de revisão'
    : 'geração';
}
