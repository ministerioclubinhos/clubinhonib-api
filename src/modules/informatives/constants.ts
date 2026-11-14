/** Paginação padrão da listagem de informativos. */
export const INFORMATIVES_DEFAULT_PAGE = 1;
export const INFORMATIVES_DEFAULT_LIMIT = 12;
export const INFORMATIVES_MAX_LIMIT = 100;

/** Campos aceitos na ordenação, e o padrão. */
export const INFORMATIVE_SORT_FIELDS = ['createdAt', 'title'] as const;

export const INFORMATIVE_DEFAULT_SORT = 'createdAt';
export const INFORMATIVE_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const INFORMATIVE_SORT_COLUMNS = {
  createdAt: 'informative.createdAt',
  title: 'informative.title',
} as const satisfies Record<(typeof INFORMATIVE_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const INFORMATIVE_SEARCH_MAX_LENGTH = 200;

/** Prefixo do caminho público gerado para cada informativo. */
export const INFORMATIVE_ROUTE_PREFIX = 'informativo_';
