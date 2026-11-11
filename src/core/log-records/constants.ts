export const LOG_RECORDS_ROUTE = 'log-records';
export const LOG_RECORDS_OBSERVABILITY_PATH = 'observability';
export const LOG_RECORDS_AUDIT_PATH = 'audit';
export const LOG_RECORDS_EVENT_PARAM = 'eventId';
export const LOG_RECORDS_OBSERVABILITY_ITEM_PATH = `${LOG_RECORDS_OBSERVABILITY_PATH}/:${LOG_RECORDS_EVENT_PARAM}`;
export const LOG_RECORDS_AUDIT_ITEM_PATH = `${LOG_RECORDS_AUDIT_PATH}/:${LOG_RECORDS_EVENT_PARAM}`;

export const LOG_RECORDS_DEFAULT_PAGE = 1;
export const LOG_RECORDS_DEFAULT_LIMIT = 25;
export const LOG_RECORDS_MAX_LIMIT = 100;
/** Intervalo máximo por consulta; acima disso a API recusa (FE-BE-005). */
export const LOG_RECORDS_MAX_RANGE_DAYS = 31;
export const LOG_RECORDS_TEXT_FILTER_MAX_LENGTH = 200;

/** Textos devolvidos à tela são cortados de novo, mesmo já redigidos. */
export const LOG_RECORDS_MESSAGE_MAX_LENGTH = 512;

/** Filtros de igualdade que cada endpoint repassa ao storage. */
export const OBSERVABILITY_FILTER_FIELDS = [
  'level',
  'errorCode',
  'sourceType',
] as const;
export const AUDIT_FILTER_FIELDS = [
  'actorId',
  'actorRole',
  'outcome',
  'sourceType',
] as const;

/** Código de erro aceito no filtro: catálogo da API ou código do driver. */
export const LOG_RECORDS_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
export const LOG_RECORDS_ERROR_CODE_MAX_LENGTH = 64;
/** Filtros de texto que casam por trecho (`contains`), não por igualdade. */
export const AUDIT_CONTAINS_FIELDS = ['actionName'] as const;
export const LOG_RECORDS_ACTOR_NAME_MIN_LENGTH = 2;
export const LOG_RECORDS_ACTOR_NAME_MAX_LENGTH = 120;
