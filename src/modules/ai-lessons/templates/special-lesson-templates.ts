import { SPECIAL_LESSON_BASE_PROMPT, SPECIAL_LESSON_VISUALS_INSTRUCTION } from '../constants/lesson-editorial.constants';
import { LESSON_SHARED_QUALITY_RULES } from '../constants/lesson-quality.constants';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';
import { LESSON_TEMPLATES, LessonTemplateContract } from './lesson-templates';

const specialQualityRules = LESSON_SHARED_QUALITY_RULES.map((rule) =>
  rule.replace('Não invente falas, sentimentos, intenções, referências ou páginas de manuais.',
    'Nos relatos bíblicos, não invente falas, sentimentos ou intenções. Personagens e diálogos fictícios são permitidos somente na ilustração contemporânea identificada. Não invente referências ou páginas de manuais.'),
);

const specialLesson: LessonTemplateContract = {
  key: 'clubinho.lesson.special',
  version: '1.0.0',
  stage: LessonStageType.LESSON,
  exactStructure: LESSON_TEMPLATES.LESSON.exactStructure.map((label) =>
    label === 'HISTÓRIA BÍBLICA' ? 'HISTÓRIA E CONEXÃO BÍBLICA' :
      label === 'FALANDO COM DEUS (SOMENTE QUANDO SOLICITADO)' ? 'FALANDO COM DEUS' : label),
  rules: [...specialQualityRules, SPECIAL_LESSON_BASE_PROMPT],
};

const specialVisuals: LessonTemplateContract = {
  key: 'clubinho.lesson-visuals.special',
  version: '1.0.0',
  stage: LessonStageType.LESSON_VISUALS,
  exactStructure: [
    'QUEBRA INTEGRAL DA LIÇÃO BÍBLICA',
    'TRECHOS EM ORDEM DA NARRATIVA',
    'DESCRIÇÃO VISUAL',
    'PERSONAGENS E CONSISTÊNCIA',
    'TEXTO ALTERNATIVO',
    'ORIENTAÇÕES DE APRESENTAÇÃO',
  ],
  rules: [...specialQualityRules, SPECIAL_LESSON_VISUALS_INSTRUCTION,
    'Cubra o texto completo em trechos literais, contínuos, consecutivos e sem sobreposição. As dicas ao professor não são elementos da cena a ilustrar.'],
};

export function getLessonTemplate(stage: LessonStageType, category?: LessonCategory): LessonTemplateContract {
  if (category === LessonCategory.SPECIAL) {
    if (stage === LessonStageType.LESSON) return specialLesson;
    if (stage === LessonStageType.LESSON_VISUALS) return specialVisuals;
  }
  return LESSON_TEMPLATES[stage];
}
