import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';

/** Prefixo aplicado ao path da rota pública de uma galeria. */
export const IMAGE_PAGE_ROUTE_PATH_PREFIX = 'galeria_imagens_';

/** Subtítulo fixo da rota da galeria. */
export const IMAGE_PAGE_ROUTE_SUBTITLE = 'Página de galeria de imagens';

/** Imagem exibida no card da rota da galeria. */
export const IMAGE_PAGE_ROUTE_IMAGE_URL =
  'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_imagens.png';

/** Tipo da entidade na rota e alvo polimórfico das mídias das seções. */
export const IMAGE_PAGE_ENTITY_TYPE = MediaTargetType.ImagesPage;

/** Photos and videos share the existing per-media feed comment contract. */
export const FEED_COMMENT_MEDIA_TYPES = [
  MediaType.IMAGE,
  MediaType.VIDEO,
] as const;

/** Campo multipart que carrega o JSON das requisições. */
export const IMAGE_PAGE_PAYLOAD_FIELD = 'imageData';

/** Relações sempre carregadas junto da galeria. */
export const IMAGE_PAGE_RELATIONS = ['route', 'sections'] as const;

/** Paginação de seções: valores padrão e teto do `limit`. */
export const IMAGE_SECTIONS_DEFAULT_PAGE = 1;
export const IMAGE_SECTIONS_DEFAULT_LIMIT = 2;
export const IMAGE_SECTIONS_MAX_LIMIT = 50;

/** Paginação da listagem de galerias: valores padrão e teto do `limit`. */
export const IMAGE_PAGES_DEFAULT_PAGE = 1;
export const IMAGE_PAGES_DEFAULT_LIMIT = 12;
export const IMAGE_PAGES_MAX_LIMIT = 100;

/** Campos aceitos na ordenação da listagem, e o padrão. */
export const IMAGE_PAGE_SORT_FIELDS = ['createdAt', 'title'] as const;

export const IMAGE_PAGE_DEFAULT_SORT = 'createdAt';
export const IMAGE_PAGE_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const IMAGE_PAGE_SORT_COLUMNS = {
  createdAt: 'page.createdAt',
  // A coluna se chama `name`; o contrato expõe o mesmo dado como `title`.
  title: 'page.name',
} as const satisfies Record<(typeof IMAGE_PAGE_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const IMAGE_PAGE_SEARCH_MAX_LENGTH = 200;
