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

export const IDEAS_SHARE_MAX_MEDIAS = 20;
export const IDEAS_SHARE_MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const IDEAS_SHARE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IDEAS_SHARE_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const IDEAS_SHARE_UPLOAD_LIMITS = {
  files: IDEAS_SHARE_MAX_MEDIAS,
  fileSize: IDEAS_SHARE_MAX_VIDEO_BYTES,
  fields: 1,
};
export const IDEAS_MEDIA_TITLE_SEPARATOR = ' — ';
export const IDEAS_MEDIA_TITLE_MAX_LENGTH = 255;
export const IDEAS_MEDIA_TYPE_LABELS = {
  document: 'Documento',
  image: 'Imagem',
  video: 'Vídeo',
} as const;
export const IDEAS_SHARE_DOCUMENT_FORMATS = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'docx',
  ],
} as const;
export const IDEAS_SHARE_IMAGE_FORMATS = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
} as const;
export const IDEAS_SHARE_VIDEO_FORMATS = {
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
} as const;
