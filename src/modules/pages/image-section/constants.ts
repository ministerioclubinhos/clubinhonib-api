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

export const CLUBINHO_MAX_PHOTOS = 20;
export const CLUBINHO_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const CLUBINHO_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const CLUBINHO_UPLOAD_LIMITS = {
  files: CLUBINHO_MAX_PHOTOS,
  fileSize: CLUBINHO_MAX_VIDEO_BYTES,
  fields: 1,
};
export const CLUBINHO_IMAGE_EXTENSIONS: Readonly<
  Record<string, readonly string[]>
> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
};
export const CLUBINHO_VIDEO_EXTENSIONS: Readonly<
  Record<string, readonly string[]>
> = {
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
};
