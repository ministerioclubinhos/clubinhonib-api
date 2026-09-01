import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

/** Prefixo aplicado ao path da rota da página de ideias. */
export const IDEAS_PAGE_ROUTE_PATH_PREFIX = 'galeria_ideias_';

/** Imagem exibida no card da rota. */
export const IDEAS_PAGE_ROUTE_IMAGE_URL =
  'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_ideias.png';

/**
 * A rota da página de ideias nunca é pública: o acesso acontece pela Área do
 * Professor, não pelo menu público.
 */
export const IDEAS_PAGE_ROUTE_PUBLIC = false;

/** Tipo da entidade na rota da página. */
export const IDEAS_PAGE_ENTITY_TYPE = MediaTargetType.IdeasPage;

/** Alvo polimórfico das mídias, que pertencem à seção e não à página. */
export const IDEAS_SECTION_MEDIA_TARGET_TYPE = MediaTargetType.IdeasSection;

/** Campo multipart que carrega o JSON das requisições. */
export const IDEAS_PAGE_PAYLOAD_FIELD = 'ideasMaterialsPageData';

/** Relações sempre carregadas junto da página. */
export const IDEAS_PAGE_RELATIONS = ['route', 'sections'] as const;
