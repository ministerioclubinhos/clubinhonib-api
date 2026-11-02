import {
  SPECIAL_LESSON_BASE_PROMPT,
  SPECIAL_LESSON_VISUALS_INSTRUCTION,
} from './constants/lesson-editorial.constants';
import {
  getLessonStageOrder,
  LESSON_STAGE_ORDER,
  LessonCategory,
  LessonStageType,
  SPECIAL_LESSON_STAGE_ORDER,
} from './enums/lesson.enums';
import { lessonHeaderLines, normalizeLessonDocumentHeader } from './utils';

describe('Material Especial (SPECIAL)', () => {
  it('usa 3 etapas no Material Especial e 8 no Semanal', () => {
    expect(getLessonStageOrder(LessonCategory.SPECIAL)).toEqual([
      LessonStageType.LESSON,
      LessonStageType.LESSON_VISUALS,
      LessonStageType.VERSE_VISUALS,
    ]);
    expect(getLessonStageOrder(LessonCategory.SPECIAL)).toBe(
      SPECIAL_LESSON_STAGE_ORDER,
    );
    expect(getLessonStageOrder(LessonCategory.REGULAR)).toBe(
      LESSON_STAGE_ORDER,
    );
    expect(getLessonStageOrder(undefined)).toHaveLength(8);
  });

  it('gera cabeçalho LIÇÃO ESPECIAL com e sem semana', () => {
    expect(
      lessonHeaderLines('O Picolé Roubado', null, LessonCategory.SPECIAL),
    ).toEqual(['LIÇÃO ESPECIAL', 'TÍTULO', 'O Picolé Roubado']);
    expect(
      lessonHeaderLines('O Picolé Roubado', 1, LessonCategory.SPECIAL),
    ).toEqual(['LIÇÃO ESPECIAL 1', 'TÍTULO', 'O Picolé Roubado']);
    expect(lessonHeaderLines('Título', 3, LessonCategory.REGULAR)).toEqual([
      'LIÇÃO 3',
      'TÍTULO',
      'Título',
    ]);
  });

  it('normaliza o cabeçalho do documento do Material Especial', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            { type: 'text', text: 'LIÇÃO ESPECIAL - O Picolé Roubado' },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'texto' }] },
      ],
    };
    const result = normalizeLessonDocumentHeader(
      doc,
      undefined,
      LessonCategory.SPECIAL,
    );
    const texts = (
      result.content as Array<{ content: Array<{ text: string }> }>
    )
      .slice(0, 3)
      .map((node) => node.content[0].text);
    expect(texts).toEqual(['LIÇÃO ESPECIAL', 'TÍTULO', 'O Picolé Roubado']);
  });
});

describe('Prompts do Material Especial', () => {
  it('cobrem os dois formatos, os campos editoriais e os visuais', () => {
    const base = SPECIAL_LESSON_BASE_PROMPT;
    for (const term of [
      'FORMATO A',
      'FORMATO B',
      'specialContext',
      'memoryVerse',
      'applicationAndAppeal',
      'counseling',
      'Cartaz',
      'voluntário',
    ]) {
      expect(base).toContain(term);
    }
    expect(SPECIAL_LESSON_VISUALS_INSTRUCTION).toContain(
      'DICA PARA O PROFESSOR',
    );
  });
});
