import { CLUB_SORT_FIELDS } from './constants';

/**
 * Quem está pedindo a operação.
 *
 * Os casos de uso recebem isto, e não a requisição HTTP: quem lê o token é o
 * controller, que é a camada que enxerga o transporte.
 */
export interface ClubAccessContext {
  role?: string;
  userId?: string | null;
}

/** Campo pelo qual a listagem pode ser ordenada. */
export type ClubSortField = (typeof CLUB_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type ClubSortOrder = 'ASC' | 'DESC';
