import { FeedbackCategory } from './entities/feedback-category.enum';

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

/** Paginação padrão da listagem de avaliações. */
export const FEEDBACKS_DEFAULT_PAGE = 1;
export const FEEDBACKS_DEFAULT_LIMIT = 12;
export const FEEDBACKS_MAX_LIMIT = 100;

/** Nota mínima da avaliação do site. */
export const FEEDBACK_MIN_RATING = 1;

/** Tamanho máximo do comentário. */
export const FEEDBACK_COMMENT_MAX_LENGTH = 2000;

/** Tamanho máximo do texto de busca. */
export const FEEDBACK_SEARCH_MAX_LENGTH = 200;

/** Campos aceitos na ordenação, e o padrão. */
export const FEEDBACK_SORT_FIELDS = [
  'createdAt',
  'rating',
  'name',
  'category',
] as const;

export const FEEDBACK_DEFAULT_SORT = 'createdAt';
export const FEEDBACK_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const FEEDBACK_SORT_COLUMNS = {
  createdAt: 'feedback.createdAt',
  rating: 'feedback.rating',
  name: 'feedback.name',
  category: 'feedback.category',
} as const satisfies Record<(typeof FEEDBACK_SORT_FIELDS)[number], string>;
