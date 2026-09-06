/**
 * Contas de semana letiva, espelhando `src/shared/academic-week/academic-week.util.ts`:
 * a semana N começa na segunda-feira da semana do `startDate` mais (N-1)*7 dias.
 * As três automações de pagela usam isto para gerar `referenceDate` que a API
 * traduz na mesma semana.
 */
const { fetchAllPages } = require('../common/pagination');
const { toDateOnly } = require('../common/random');

const WEEKDAY_INDEX = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function parseDateOnly(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split('T')[0].split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(date) {
  const result = new Date(date);
  const weekday = result.getDay();
  result.setDate(result.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  result.setHours(12, 0, 0, 0);
  return result;
}

function computeTotalWeeks(period) {
  const start = parseDateOnly(period?.startDate);
  const end = parseDateOnly(period?.endDate);
  if (!start || !end) return 44;
  const days = Math.floor((startOfWeek(end) - startOfWeek(start)) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/** Semana letiva de uma data, ou null fora do período (igual à API). */
function academicWeekOf(dateStr, period) {
  const reference = parseDateOnly(dateStr);
  const start = parseDateOnly(period.startDate);
  const end = parseDateOnly(period.endDate);
  if (!reference || reference < start || reference > end) return null;
  const days = Math.floor((startOfWeek(reference) - startOfWeek(start)) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/**
 * Data do encontro da semana `week` no dia `weekday` do clubinho, ajustada
 * para caber no período (a primeira e a última semana podem ser parciais).
 */
function dateForWeek(period, week, weekday) {
  const start = parseDateOnly(period.startDate);
  const end = parseDateOnly(period.endDate);
  const monday = startOfWeek(start);
  monday.setDate(monday.getDate() + (week - 1) * 7);
  const target = new Date(monday);
  target.setDate(monday.getDate() + ((WEEKDAY_INDEX[weekday] ?? 6) - 1));
  if (target < start) return toDateOnly(start);
  if (target > end) return toDateOnly(end);
  return toDateOnly(target);
}

/** Primeira semana em que a criança já estava no clubinho. */
function startWeekFor(child, period) {
  if (!child?.joinedAt) return 1;
  const week = academicWeekOf(String(child.joinedAt).split('T')[0], period);
  if (week) return week;
  const joined = parseDateOnly(child.joinedAt);
  const start = parseDateOnly(period.startDate);
  return joined && start && joined > start ? Number.POSITIVE_INFINITY : 1;
}

function randomAttendance(week) {
  const present = Math.random() > 0.2;
  return {
    present,
    didMeditation: present && Math.random() > 0.3,
    recitedVerse: present && Math.random() > 0.4,
    notes: present ? (Math.random() > 0.7 ? `Semana ${week}: participou bem` : null) : 'Faltou',
  };
}

async function listPagelasOfChild(http, childId, year) {
  return fetchAllPages(http.request, 'get', '/pagelas/paginated', { childId, year }, { limit: 200 });
}

async function countPagelasOfChild(http, childId, year) {
  const res = await http.request('get', '/pagelas/paginated', { params: { childId, year, page: 1, limit: 1 } });
  return Number(res.data?.total ?? 0);
}

async function loadChildren(http, { limit = 0, forcedId = '' } = {}) {
  let children = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100, maxPages: 500 });
  if (limit > 0) children = children.slice(0, limit);
  if (forcedId) children = children.filter((c) => c?.id === forcedId);
  return children;
}

module.exports = {
  parseDateOnly,
  computeTotalWeeks,
  academicWeekOf,
  dateForWeek,
  startWeekFor,
  randomAttendance,
  listPagelasOfChild,
  countPagelasOfChild,
  loadChildren,
};
