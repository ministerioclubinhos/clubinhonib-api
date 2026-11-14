import { COMMENT_SORT_FIELDS } from './constants';

/** Campo pelo qual a listagem pode ser ordenada. */
export type CommentSortField = (typeof COMMENT_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type CommentSortOrder = 'ASC' | 'DESC';
