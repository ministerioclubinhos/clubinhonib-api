import {
  CUTOUT_CUT_LINE_RULE,
  LESSON_VISUAL_STYLE_PROMPTS,
} from '../constants/lesson-visual-style.constants';
import { LessonImagePurpose } from '../providers/lesson-llm.types';
import { lessonImageTextPolicy } from './meditation-image.utils';
import {
  LessonCategory,
  LessonStageType,
  LessonVisualStyle,
  LessonVisualType,
} from '../enums/lesson.enums';
import { getLessonTemplate } from '../templates/special-lesson-templates';
import {
  isCutoutKitVisuals,
  resolveLessonVisualStyle,
  withLessonVisualStyle,
} from './story-visual-mode.utils';
import { validateVisualConfig } from './lesson-generation-validation.utils';

describe('formato e estilo dos visuais da história', () => {
  it('lição semanal: kit por padrão, cenas quando escolhidas; especial sempre cenas', () => {
    expect(isCutoutKitVisuals(LessonCategory.REGULAR)).toBe(true);
    expect(
      isCutoutKitVisuals(
        LessonCategory.REGULAR,
        LessonVisualType.STORY_SEQUENCE,
      ),
    ).toBe(false);
    expect(
      isCutoutKitVisuals(LessonCategory.SPECIAL, LessonVisualType.CUTOUT_KIT),
    ).toBe(false);
  });

  it('usa o template de cenas completas só na lição semanal com cenas', () => {
    expect(
      getLessonTemplate(
        LessonStageType.LESSON_VISUALS,
        LessonCategory.REGULAR,
        LessonVisualType.STORY_SEQUENCE,
      ).key,
    ).toBe('clubinho.lesson-visuals.scenes');
    expect(
      getLessonTemplate(LessonStageType.LESSON_VISUALS, LessonCategory.REGULAR)
        .key,
    ).toBe('clubinho.lesson-visuals.canonical');
  });

  it('aceita cenas completas na lição semanal e grava o estilo, com padrão infantil fofo', () => {
    const base = {
      visualOrientation: 'LANDSCAPE',
      visualQuantity: 6,
    } as const;
    expect(
      validateVisualConfig(
        {
          ...base,
          visualType: LessonVisualType.STORY_SEQUENCE,
          visualStyle: LessonVisualStyle.CLASSIC_CARTOON,
        } as Parameters<typeof validateVisualConfig>[0],
        LessonCategory.REGULAR,
      ),
    ).toMatchObject({
      type: LessonVisualType.STORY_SEQUENCE,
      style: LessonVisualStyle.CLASSIC_CARTOON,
    });
    expect(
      validateVisualConfig(
        base as Parameters<typeof validateVisualConfig>[0],
        LessonCategory.REGULAR,
      ),
    ).toMatchObject({
      type: LessonVisualType.CUTOUT_KIT,
      style: LessonVisualStyle.CUTE_CARTOON,
    });
  });

  it('fecha o prompt de cada imagem com o estilo escolhido', () => {
    expect(resolveLessonVisualStyle('desconhecido')).toBe(
      LessonVisualStyle.CUTE_CARTOON,
    );
    // A version saved before styles existed keeps the style it was drawn in.
    expect(
      resolveLessonVisualStyle(undefined, LessonVisualStyle.ILLUSTRATED),
    ).toBe(LessonVisualStyle.ILLUSTRATED);
    for (const style of Object.values(LessonVisualStyle))
      expect(LESSON_VISUAL_STYLE_PROMPTS[style]).toContain(
        'nunca fotorrealista',
      );
    const prompt = withLessonVisualStyle(
      'Prancha de personagens.',
      LessonVisualStyle.CLASSIC_CARTOON,
    );
    expect(prompt.startsWith('Prancha de personagens.')).toBe(true);
    expect(
      prompt.endsWith(
        LESSON_VISUAL_STYLE_PROMPTS[LessonVisualStyle.CLASSIC_CARTOON],
      ),
    ).toBe(true);
  });

  it('toda prancha de recorte pede a linha de corte preta', () => {
    expect(lessonImageTextPolicy(LessonImagePurpose.CUTOUT_SHEET)).toContain(
      CUTOUT_CUT_LINE_RULE,
    );
    expect(lessonImageTextPolicy()).not.toContain('LINHA DE CORTE');
  });
});
