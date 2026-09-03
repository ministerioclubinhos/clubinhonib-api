/** Paginação padrão da fila de fotos. */
export const IMAGE_SECTIONS_DEFAULT_PAGE = 1;
export const IMAGE_SECTIONS_DEFAULT_LIMIT = 12;
export const IMAGE_SECTIONS_MAX_LIMIT = 100;

/** Campos aceitos na ordenação, e o padrão. */
export const IMAGE_SECTION_SORT_FIELDS = ['createdAt', 'caption'] as const;

export const IMAGE_SECTION_DEFAULT_SORT = 'createdAt';
export const IMAGE_SECTION_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const IMAGE_SECTION_SORT_COLUMNS = {
  createdAt: 'section.createdAt',
  caption: 'section.caption',
} as const satisfies Record<(typeof IMAGE_SECTION_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const IMAGE_SECTION_SEARCH_MAX_LENGTH = 200;

/**
 * Campo do multipart que carrega o JSON da seção.
 *
 * Os arquivos vêm nos demais campos, cada um endereçado pelo `fieldKey` da
 * mídia correspondente.
 */
export const IMAGE_SECTION_PAYLOAD_FIELD = 'sectionData';
