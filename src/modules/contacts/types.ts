import { CONTACT_SORT_FIELDS } from './constants';

/** Campo pelo qual a listagem pode ser ordenada. */
export type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type ContactSortOrder = 'ASC' | 'DESC';
