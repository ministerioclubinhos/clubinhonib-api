/** Tamanho da coluna `routes.path`. */
export const ROUTE_PATH_MAX_LENGTH = 255;

/** Espaço reservado para o sufixo numérico de desempate (`_1`, `_12`). */
export const ROUTE_PATH_SUFFIX_RESERVE = 16;

/** Corpo usado quando o título não deixa nenhum caractere aproveitável. */
export const ROUTE_PATH_FALLBACK_BODY = 'pagina';

/** Tentativas de gravar a rota quando o `path` colide na inserção. */
export const ROUTE_PATH_INSERT_ATTEMPTS = 5;

/** Códigos de violação de unicidade (MySQL e PostgreSQL). */
export const ROUTE_DUPLICATE_ERROR_CODES: readonly string[] = [
  'ER_DUP_ENTRY',
  '23505',
];
