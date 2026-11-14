import {
  A4_COMPOSITION_RULE,
  DEFAULT_LESSON_VISUAL_STYLE,
  LESSON_VISUAL_STYLE_PROMPTS,
} from '../constants/lesson-visual-style.constants';
import {
  LessonCategory,
  LessonVisualStyle,
  LessonVisualType,
} from '../enums/lesson.enums';

/**
 * Whether the story visuals are a cutout kit. Special lessons always use
 * scenes; a weekly lesson follows the chosen type and, without one (older
 * requests), the kit.
 */
export function isCutoutKitVisuals(
  category: LessonCategory | null | undefined,
  visualType?: string | null,
): boolean {
  if (category === LessonCategory.SPECIAL) return false;
  return !visualType || visualType === String(LessonVisualType.CUTOUT_KIT);
}

/** Saved or requested style; anything unknown falls back to `fallback`. */
export function resolveLessonVisualStyle(
  value: unknown,
  fallback: LessonVisualStyle = DEFAULT_LESSON_VISUAL_STYLE,
): LessonVisualStyle {
  return Object.values(LessonVisualStyle).includes(value as LessonVisualStyle)
    ? (value as LessonVisualStyle)
    : fallback;
}

export function lessonVisualStylePrompt(value: unknown): string {
  return LESSON_VISUAL_STYLE_PROMPTS[resolveLessonVisualStyle(value)];
}

/** The chosen drawing style closes every image prompt, so it wins over any other style text. */
export function withLessonVisualStyle(prompt: string, style: unknown): string {
  return `${prompt}\n\nESTILO DE DESENHO OBRIGATÓRIO (prevalece sobre qualquer outra descrição de estilo acima): ${lessonVisualStylePrompt(style)}`;
}

/** A full-page story visual is composed for an A4 sheet, with a safe margin. */
export function withA4Composition(prompt: string): string {
  return `${prompt}\n\n${A4_COMPOSITION_RULE}`;
}
