import { UserRole } from 'src/core/auth/auth.types';

/** Paginação padrão da listagem de perfis. */
export const PROFILES_DEFAULT_PAGE = 1;
export const PROFILES_DEFAULT_LIMIT = 12;
export const PROFILES_MAX_LIMIT = 100;

/** Papéis que enxergam a listagem de perfis dos outros. */
export const PROFILE_LIST_ROLES = [
  UserRole.ADMIN,
  UserRole.COORDINATOR,
] as const;

/** Campo pelo qual a listagem de perfis pode ser ordenada. */
export enum ProfileSortField {
  NAME = 'name',
  EMAIL = 'email',
  CREATED_AT = 'createdAt',
  BIRTH_DATE = 'birthDate',
}

/** Direção da ordenação. */
export enum ProfileSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const PROFILE_DEFAULT_SORT = ProfileSortField.NAME;
export const PROFILE_DEFAULT_ORDER = ProfileSortOrder.ASC;

/**
 * Coluna do banco por campo de ordenação.
 *
 * A consulta nunca interpola o valor recebido: só um destes nomes chega ao SQL.
 */
export const PROFILE_SORT_COLUMNS: Record<ProfileSortField, string> = {
  [ProfileSortField.NAME]: 'u.name',
  [ProfileSortField.EMAIL]: 'u.email',
  [ProfileSortField.CREATED_AT]: 'u.createdAt',
  [ProfileSortField.BIRTH_DATE]: 'pd.birthDate',
};

/** Papéis que a listagem aceita como filtro. */
export const PROFILE_FILTERABLE_ROLES = [
  'admin',
  'teacher',
  'coordinator',
] as const;

/**
 * Teto da faixa de aniversariantes do mês.
 *
 * A faixa é acessória, e o ministério não chega perto disto; o limite existe
 * para a consulta nunca ficar sem fronteira.
 */
export const PROFILE_BIRTHDAY_MAX_RESULTS = 200;

/** Tamanho máximo dos textos livres do perfil. */
export const PROFILE_TEXT_MAX_LENGTH = 255;
