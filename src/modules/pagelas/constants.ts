import { UserRole } from 'src/core/auth/auth.types';

/**
 * Papéis que podem trabalhar com pagelas.
 *
 * Administrador enxerga tudo; coordenador e professor enxergam apenas o que
 * está sob o alcance deles — a regra de alcance mora em
 * `PagelasRepository.applyAccessFilter`.
 */
export const PAGELA_ROLES = [
  UserRole.ADMIN,
  UserRole.COORDINATOR,
  UserRole.TEACHER,
] as const;

/** Papel que não tem o alcance limitado a clubinho algum. */
export const PAGELA_UNRESTRICTED_ROLE = UserRole.ADMIN;

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

/**
 * O que dizer quando o lançamento está fechado.
 *
 * `{start}` e `{end}` são trocados pelas datas do período em questão.
 */
export const PAGELA_LAUNCH_CLOSED_MESSAGES = {
  NO_PERIOD:
    'Não há período letivo cadastrado. Pagelas só podem ser lançadas dentro do período letivo.',
  NOT_STARTED:
    'O período letivo começa em {start}. Pagelas só podem ser lançadas a partir dessa data.',
  ENDED:
    'O período letivo terminou em {end}. Não é mais possível lançar pagelas.',
} as const;

/** Mensagens das recusas de data e semana dentro de um período aberto. */
export const PAGELA_PERIOD_MESSAGES = {
  FUTURE_DATE: 'A data da pagela não pode ser depois de hoje.',
  DATE_OUTSIDE: 'A data da pagela está fora do período letivo.',
  YEAR_OUTSIDE: 'O ano da pagela não é o do período letivo em andamento.',
  WEEK_OUTSIDE:
    'A semana da pagela precisa estar entre a 1 e a semana letiva atual ({current}).',
} as const;

/** Recusa de pagela para criança desativada. */
export const PAGELA_INACTIVE_CHILD_MESSAGE =
  'Esta criança está desativada. Reative-a para lançar ou editar pagelas.';
