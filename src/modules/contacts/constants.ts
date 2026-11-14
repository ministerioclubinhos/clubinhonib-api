/** Paginação padrão da listagem de contatos. */
export const CONTACTS_DEFAULT_PAGE = 1;
export const CONTACTS_DEFAULT_LIMIT = 12;
export const CONTACTS_MAX_LIMIT = 100;

/** Campos aceitos na ordenação, e o padrão. */
export const CONTACT_SORT_FIELDS = ['createdAt', 'name', 'email'] as const;

export const CONTACT_DEFAULT_SORT = 'createdAt';
export const CONTACT_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const CONTACT_SORT_COLUMNS = {
  createdAt: 'contact.createdAt',
  name: 'contact.name',
  email: 'contact.email',
} as const satisfies Record<(typeof CONTACT_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const CONTACT_SEARCH_MAX_LENGTH = 200;
