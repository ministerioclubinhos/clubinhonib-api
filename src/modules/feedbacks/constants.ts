import { FeedbackCategory } from './entity/feedback-category.enum';

/** Rótulo legível de cada categoria, usado no aviso enviado aos admins. */
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  [FeedbackCategory.CONTENT]: 'Conteúdo do site',
  [FeedbackCategory.APPEARANCE]: 'Aparência e organização',
  [FeedbackCategory.USABILITY]: 'Facilidade de uso',
  [FeedbackCategory.BROKEN_FEATURE]: 'Algo não está funcionando',
  [FeedbackCategory.MISSING_FEATURE]: 'Falta uma funcionalidade',
  [FeedbackCategory.PERFORMANCE]: 'Velocidade ou desempenho',
  [FeedbackCategory.MOBILE_EXPERIENCE]: 'Problemas no celular',
  [FeedbackCategory.SUGGESTION]: 'Sugestão de melhoria',
  [FeedbackCategory.COMPLAINT]: 'Reclamação',
  [FeedbackCategory.OTHER]: 'Outro',
};

/** Nota máxima da avaliação do site. */
export const FEEDBACK_MAX_RATING = 5;
