/** Paginação padrão da fila de ideias compartilhadas. */
export const IDEAS_SECTIONS_DEFAULT_PAGE = 1;
export const IDEAS_SECTIONS_DEFAULT_LIMIT = 12;
export const IDEAS_SECTIONS_MAX_LIMIT = 100;

/** Campos aceitos na ordenação, e o padrão. */
export const IDEAS_SECTION_SORT_FIELDS = ['createdAt', 'title'] as const;

export const IDEAS_SECTION_DEFAULT_SORT = 'createdAt';
export const IDEAS_SECTION_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const IDEAS_SECTION_SORT_COLUMNS = {
  createdAt: 'section.createdAt',
  title: 'section.title',
} as const satisfies Record<(typeof IDEAS_SECTION_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const IDEAS_SECTION_SEARCH_MAX_LENGTH = 200;

/**
 * Campo do multipart que carrega o JSON da seção.
 *
 * Os arquivos vêm nos demais campos, cada um endereçado pelo `fieldKey` da
 * mídia correspondente.
 */
export const IDEAS_SECTION_PAYLOAD_FIELD = 'sectionData';
