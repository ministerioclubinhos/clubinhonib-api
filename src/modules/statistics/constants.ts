/**
 * Conjuntos finitos e ajustes do módulo de estatísticas.
 */

import { DecisionType } from '../accepted-christs/enums/decision-type.enum';

/**
 * Por quanto tempo o panorama vale sem refazer as contas.
 *
 * `getOverviewStatistics` dispara dezoito chamadas de repositório, e várias
 * delas fazem consultas em paralelo por dentro: um request é da ordem de trinta
 * idas ao banco. Antes não havia cache nenhum — cada carga da tela, cada
 * remontagem de aba e cada administrador pagavam a conta inteira.
 *
 * Um minuto é curto de propósito. O painel não é um relógio: pagela não muda de
 * segundo a segundo. Mas o botão "Atualizar" precisa parecer que atualiza, e um
 * cache de quinze minutos faria a tela ignorar o clique sem explicar por quê.
 */
export const OVERVIEW_CACHE_TTL_MS = 60 * 1000;

/**
 * Dia em que a criança deixou de frequentar, como o banco o enxerga.
 *
 * Quem foi desativada antes de a coluna `deactivatedAt` existir tem `null`
 * nela; para essas o dia é o da última alteração do cadastro — a aproximação
 * combinada com o dono do produto.
 */
export const CHILD_DEACTIVATION_DAY_SQL =
  'COALESCE(child.deactivatedAt, DATE(child.updatedAt))';

/**
 * "A criança estava matriculada nesta data", em SQL.
 *
 * É a mesma regra de `wasEnrolledAt` (`utils/enrollment.utils.ts`): entrou até
 * a data e ainda não tinha sido desativada nela. Substitui o filtro pelo
 * `isActive` **atual** nas agregações históricas — com ele, desativar uma
 * criança em novembro apagava as pagelas dela de março a outubro.
 *
 * Espera os apelidos `child` (criança) na consulta.
 */
const enrolledAtSql = (dateExpression: string): string =>
  `((child.joinedAt IS NULL OR child.joinedAt <= ${dateExpression}) ` +
  `AND (child.isActive = 1 OR ${CHILD_DEACTIVATION_DAY_SQL} >= ${dateExpression}))`;

/** Matriculada na data da pagela (apelido `pagela`). */
export const ENROLLED_AT_PAGELA_DATE_SQL = enrolledAtSql(
  'pagela.referenceDate',
);

/** Matriculada no dia em que a decisão foi registrada (apelido `ac`). */
export const ENROLLED_AT_DECISION_DATE_SQL =
  enrolledAtSql('DATE(ac.createdAt)');

/** Matriculada na data passada no parâmetro `:enrolledAt`. */
export const ENROLLED_AT_PARAM_DATE_SQL = enrolledAtSql(':enrolledAt');

/** Abaixo desta taxa de presença (0 a 100) o clubinho entra no indicador. */
export const LOW_ATTENDANCE_THRESHOLD = 70;

/** Abaixo deste engajamento (0 a 100) a criança entra no indicador. */
export const LOW_ENGAGEMENT_THRESHOLD = 50;

/** Dias sem presença a partir dos quais criança ou professor deixa de ser "ativo". */
export const ACTIVITY_WINDOW_DAYS = 30;

/**
 * Quantos dias depois da segunda-feira cai cada dia da semana.
 *
 * A semana letiva vai de segunda a domingo, então o domingo é o último dia —
 * a mesma convenção de `AcademicWeekService.getExpectedDateForAcademicWeek`.
 */
export const WEEKDAY_OFFSET_FROM_MONDAY: Readonly<Record<string, number>> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

/**
 * Crianças distintas que tomaram cada tipo de decisão (apelidos `ac` e `child`).
 *
 * O total "aceitaram" conta **crianças**, não linhas: um registro duplicado —
 * há legados — fazia a mesma criança aceitar duas vezes. Dentro de cada tipo a
 * criança conta uma vez só.
 */
export const DISTINCT_ACCEPTED_CHILDREN_SQL = `COUNT(DISTINCT CASE WHEN ac.decision = '${DecisionType.ACCEPTED}' THEN child.id END)`;
export const DISTINCT_RECONCILED_CHILDREN_SQL = `COUNT(DISTINCT CASE WHEN ac.decision = '${DecisionType.RECONCILED}' THEN child.id END)`;

/** Faixas de tempo de participação, na ordem em que as telas as mostram. */
export const PARTICIPATION_TIME_RANGES: readonly string[] = [
  '0-3 meses',
  '3-6 meses',
  '6-12 meses',
  '1+ ano',
];

/** Tamanho de página padrão da linha do tempo e da lista de clubinhos. */
export const ATTENDANCE_DEFAULT_PAGE_SIZE = 50;

/** Tamanho de página fixo da lista de semanas em falta. */
export const MISSING_WEEKS_PAGE_SIZE = 20;

/** A partir de quantas semanas em falta o alerta deixa de ser aviso. */
export const CRITICAL_MISSING_WEEKS = 3;

/** Abaixo desta frequência (0 a 100) o clubinho recebe alerta crítico. */
export const LOW_WEEKLY_ATTENDANCE_THRESHOLD = 50;
