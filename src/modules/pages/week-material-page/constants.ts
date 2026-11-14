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

/**
 * Marca gravada na descrição das páginas de Material Especial. Um material
 * especial é um material semanal com título e descrição próprios; o painel lê
 * a marca para exibir o selo.
 */
export const WEEK_MATERIAL_SPECIAL_TAG = '[tipo:especial]';

/**
 * Marca legada de origem (lição do Estúdio) gravada na descrição. O vínculo
 * vigente é a coluna `sourceLessonId`; a marca só sobrevive em páginas antigas.
 */
export const WEEK_MATERIAL_ORIGIN_MARKER_PREFIX = '[origem:licao:';

/** Marcas internas que nunca devem aparecer para o público. */
export const WEEK_MATERIAL_INTERNAL_MARKERS_PATTERN =
  /\s*\[(?:tipo:especial|origem:licao:[^\]]*)\]/gi;

/** Quantas páginas a busca de possíveis duplicatas examina e devolve. */
export const WEEK_MATERIAL_DUPLICATE_SCAN_LIMIT = 50;
export const WEEK_MATERIAL_DUPLICATE_RESULT_LIMIT = 5;
/** Longest title words sent to the database when looking for a same-title page. */
export const WEEK_MATERIAL_DUPLICATE_FRAGMENT_LIMIT = 3;
/** Word that names the week in a weekly material title ("Semana 12"). */
export const WEEK_MATERIAL_WEEK_WORD = 'semana';
