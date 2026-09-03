import { PROFILE_SORT_FIELDS } from './constants';

/**
 * Quem está pedindo a operação.
 *
 * Os casos de uso recebem isto, e não a requisição HTTP: quem lê o token é o
 * controller, que é a camada que enxerga o transporte.
 */
export interface ProfileAccessContext {
  role?: string;
  userId?: string | null;
}

/**
 * O que o mapper precisa saber do usuário.
 *
 * Só estes cinco campos entram na resposta, então exigir a entidade inteira
 * impediria a listagem — que lê os perfis por consulta direta — de usar o
 * mesmo mapper.
 */
export interface ProfileUserSource {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: string;
}

/** Campo pelo qual a listagem pode ser ordenada. */
export type ProfileSortField = (typeof PROFILE_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type ProfileSortOrder = 'ASC' | 'DESC';
