/** Paginação padrão da listagem de comentários. */
export const COMMENTS_DEFAULT_PAGE = 1;
export const COMMENTS_DEFAULT_LIMIT = 12;
export const COMMENTS_MAX_LIMIT = 100;

/** Quantos comentários publicados a home mostra. */
export const COMMENTS_PUBLISHED_LIMIT = 50;

/** Campos aceitos na ordenação, e o padrão. */
export const COMMENT_SORT_FIELDS = ['createdAt', 'name', 'clubinho'] as const;

export const COMMENT_DEFAULT_SORT = 'createdAt';
export const COMMENT_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const COMMENT_SORT_COLUMNS = {
  createdAt: 'comment.createdAt',
  name: 'comment.name',
  clubinho: 'comment.clubinho',
} as const satisfies Record<(typeof COMMENT_SORT_FIELDS)[number], string>;

/** Limites de tamanho, iguais aos das colunas. */
export const COMMENT_NAME_MAX_LENGTH = 100;
export const COMMENT_CLUBINHO_MAX_LENGTH = 100;
export const COMMENT_NEIGHBORHOOD_MAX_LENGTH = 100;
export const COMMENT_TEXT_MAX_LENGTH = 2000;

/** Tamanho máximo do texto de busca. */
export const COMMENT_SEARCH_MAX_LENGTH = 200;
