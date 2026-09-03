import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

/** Prefix applied to every generated public route path of a week material page. */
export const WEEK_MATERIAL_ROUTE_PATH_PREFIX = 'materiais_semanal_';

/** Card image rendered by the frontend for week material routes. */
export const WEEK_MATERIAL_ROUTE_IMAGE_URL =
  'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card_materiais.png';

/** Entity type stored on the route row and used as the media polymorphic target. */
export const WEEK_MATERIAL_ENTITY_TYPE = MediaTargetType.WeekMaterialsPage;

/** Multipart field carrying the JSON payload of create/update requests. */
export const WEEK_MATERIAL_PAYLOAD_FIELD = 'weekMaterialsPageData';

/** Relations always loaded with a week material page. */
export const WEEK_MATERIAL_PAGE_RELATIONS = ['route'] as const;

/** Paginação da listagem de páginas de materiais semanais. */
export const WEEK_MATERIALS_DEFAULT_PAGE = 1;
export const WEEK_MATERIALS_DEFAULT_LIMIT = 12;
export const WEEK_MATERIALS_MAX_LIMIT = 100;

/** Campos aceitos na ordenação da listagem, e o padrão. */
export const WEEK_MATERIAL_SORT_FIELDS = ['createdAt', 'title'] as const;

export const WEEK_MATERIAL_DEFAULT_SORT = 'createdAt';
export const WEEK_MATERIAL_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const WEEK_MATERIAL_SORT_COLUMNS = {
  createdAt: 'page.createdAt',
  title: 'page.title',
} as const satisfies Record<(typeof WEEK_MATERIAL_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const WEEK_MATERIAL_SEARCH_MAX_LENGTH = 200;
