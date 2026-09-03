/** Paginação padrão da listagem de perfis. */
export const PROFILES_DEFAULT_PAGE = 1;
export const PROFILES_DEFAULT_LIMIT = 12;
export const PROFILES_MAX_LIMIT = 100;

/** Papéis que enxergam a listagem de perfis dos outros. */
export const PROFILE_LIST_ROLES = ['admin', 'coordinator'] as const;

/** Campos aceitos na ordenação, e o padrão. */
export const PROFILE_SORT_FIELDS = [
  'name',
  'email',
  'createdAt',
  'birthDate',
] as const;

export const PROFILE_DEFAULT_SORT = 'name';
export const PROFILE_DEFAULT_ORDER = 'ASC';

/** Tamanho máximo dos textos livres do perfil. */
export const PROFILE_TEXT_MAX_LENGTH = 255;
