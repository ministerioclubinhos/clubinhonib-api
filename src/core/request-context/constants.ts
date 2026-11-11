/** Cabeçalho devolvido em toda resposta para o suporte correlacionar. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Módulo atribuído a um `context` de log que não pertence ao grafo Nest. */
export const UNKNOWN_MODULE_NAME = 'unknown-module';

/** Nome do boundary de requests que não casaram com nenhum handler. */
export const UNMATCHED_ROUTE_ACTION_NAME = 'http.unmatched';

/** Tamanho máximo aceito para um caminho sanitizado em nome de boundary. */
export const ROUTE_PATH_MAX_LENGTH = 200;

/** Limite do nome de exibição do ator gravado na auditoria. */
export const ACTOR_NAME_MAX_LENGTH = 120;
