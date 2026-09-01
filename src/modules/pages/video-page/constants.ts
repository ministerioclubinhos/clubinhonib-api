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
