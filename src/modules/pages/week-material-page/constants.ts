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
