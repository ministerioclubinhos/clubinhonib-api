import { LessonStageType } from '../enums/lesson.enums';

export const LESSON_PUBLICATION_TITLES: Record<LessonStageType, string> = {
  [LessonStageType.LESSON]: 'Lição completa',
  [LessonStageType.LESSON_VISUALS]: 'Visuais da história',
  [LessonStageType.STANDARD_GAME]: 'Brincadeira',
  [LessonStageType.VERSE_VISUALS]: 'Visuais do versículo',
  [LessonStageType.VERSE_FIXATION]: 'Fixação divertida do versículo',
  [LessonStageType.MEDITATION_YOUNGER]: 'Meditação dos menores',
  [LessonStageType.MEDITATION_OLDER]: 'Meditação dos maiores',
  [LessonStageType.MANUAL_WORK]: 'Trabalho manual',
};
