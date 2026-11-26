import { DOCUMENT_SORT_FIELDS } from './constants';

/** Campo pelo qual a listagem pode ser ordenada. */
export type DocumentSortField = (typeof DOCUMENT_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type DocumentSortOrder = 'ASC' | 'DESC';
