import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

/** Prefixo aplicado ao path da rota pública da galeria de vídeos. */
export const VIDEO_PAGE_ROUTE_PATH_PREFIX = 'galeria_videos_';

/** Subtítulo fixo da rota da galeria de vídeos. */
export const VIDEO_PAGE_ROUTE_SUBTITLE = 'Página de galeria de vídeos';

/** Imagem exibida no card da rota. */
export const VIDEO_PAGE_ROUTE_IMAGE_URL =
  'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_videos.png';

/** Tipo da entidade na rota e alvo polimórfico das mídias. */
export const VIDEO_PAGE_ENTITY_TYPE = MediaTargetType.VideosPage;

/** Campo multipart que carrega o JSON das requisições. */
export const VIDEO_PAGE_PAYLOAD_FIELD = 'videosPageData';

/** Relações sempre carregadas junto da página. */
export const VIDEO_PAGE_RELATIONS = ['route'] as const;

/** Paginação da listagem de páginas de vídeos. */
export const VIDEO_PAGES_DEFAULT_PAGE = 1;
export const VIDEO_PAGES_DEFAULT_LIMIT = 12;
export const VIDEO_PAGES_MAX_LIMIT = 100;

/** Campos aceitos na ordenação da listagem, e o padrão. */
export const VIDEO_PAGE_SORT_FIELDS = ['createdAt', 'title'] as const;

export const VIDEO_PAGE_DEFAULT_SORT = 'createdAt';
export const VIDEO_PAGE_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const VIDEO_PAGE_SORT_COLUMNS = {
  createdAt: 'page.createdAt',
  // A coluna se chama `name`; o contrato expõe o mesmo dado como `title`.
  title: 'page.name',
} as const satisfies Record<(typeof VIDEO_PAGE_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const VIDEO_PAGE_SEARCH_MAX_LENGTH = 200;
