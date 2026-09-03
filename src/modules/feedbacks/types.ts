import { FEEDBACK_SORT_FIELDS } from './constants';

/** Campo pelo qual a listagem pode ser ordenada. */
export type FeedbackSortField = (typeof FEEDBACK_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type FeedbackSortOrder = 'ASC' | 'DESC';
