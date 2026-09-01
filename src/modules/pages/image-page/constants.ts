import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

/** Prefixo aplicado ao path da rota pública de uma galeria. */
export const IMAGE_PAGE_ROUTE_PATH_PREFIX = 'galeria_imagens_';

/** Subtítulo fixo da rota da galeria. */
export const IMAGE_PAGE_ROUTE_SUBTITLE = 'Página de galeria de imagens';

/** Imagem exibida no card da rota da galeria. */
export const IMAGE_PAGE_ROUTE_IMAGE_URL =
  'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_imagens.png';

/** Tipo da entidade na rota e alvo polimórfico das mídias das seções. */
export const IMAGE_PAGE_ENTITY_TYPE = MediaTargetType.ImagesPage;

/** Campo multipart que carrega o JSON das requisições. */
export const IMAGE_PAGE_PAYLOAD_FIELD = 'imageData';

/** Relações sempre carregadas junto da galeria. */
export const IMAGE_PAGE_RELATIONS = ['route', 'sections'] as const;

/** Paginação de seções: valores padrão e teto do `limit`. */
export const IMAGE_SECTIONS_DEFAULT_PAGE = 1;
export const IMAGE_SECTIONS_DEFAULT_LIMIT = 2;
export const IMAGE_SECTIONS_MAX_LIMIT = 50;
