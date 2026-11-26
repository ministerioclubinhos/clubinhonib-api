import { INFORMATIVE_SORT_FIELDS } from './constants';

/** Campo pelo qual a listagem pode ser ordenada. */
export type InformativeSortField = (typeof INFORMATIVE_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type InformativeSortOrder = 'ASC' | 'DESC';
