/**
 * Papéis que podem trabalhar com pagelas.
 *
 * Administrador enxerga tudo; coordenador e professor enxergam apenas o que
 * está sob o alcance deles — a regra de alcance mora em
 * `PagelasRepository.applyAccessFilter`.
 */
export const PAGELA_ROLES = ['admin', 'coordinator', 'teacher'] as const;

/** Papel que não tem o alcance limitado a clubinho algum. */
export const PAGELA_UNRESTRICTED_ROLE = 'admin';

/** Paginação padrão da listagem. */
export const PAGELAS_DEFAULT_PAGE = 1;
export const PAGELAS_DEFAULT_LIMIT = 20;
export const PAGELAS_MAX_LIMIT = 200;

/** Faixa aceita para a semana e o ano letivos. */
export const PAGELA_MIN_WEEK = 1;
export const PAGELA_MAX_WEEK = 53;
export const PAGELA_MIN_YEAR = 2000;
export const PAGELA_MAX_YEAR = 9999;

/** Tamanho da coluna `notes`; passar disso quebraria a gravação. */
export const PAGELA_NOTES_MAX_LENGTH = 500;

/** Tamanho máximo do texto de busca. */
export const PAGELA_SEARCH_MAX_LENGTH = 200;

/**
 * Anos vizinhos consultados ao procurar o período letivo de uma data.
 *
 * O período costuma atravessar a virada do ano, então a data de referência
 * pode cair no ano anterior ou no seguinte ao do período cadastrado.
 */
export const PAGELA_PERIOD_YEAR_OFFSETS = [0, -1, 1] as const;
