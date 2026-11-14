const { ACADEMIC_YEAR } = require('../common/config');
const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Todos os GET de `/statistics`, com filtros e paginação, mais as recusas por papel. */
async function run({ http, logger, ctx }) {
  logger.section('statistics/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });
  const year = ctx?.year ?? ACADEMIC_YEAR;
  const week = ctx.currentWeek?.week ?? 5;

  const simple = [
    ['/statistics/overview', {}],
    ['/statistics/pagelas', { year }],
    ['/statistics/pagelas', { period: 'this_year', onlyPresent: true }],
    ['/statistics/pagelas/charts', { year, groupBy: 'month' }],
    ['/statistics/pagelas/charts', { period: 'last_30_days' }],
    ['/statistics/accepted-christs', { groupBy: 'month', year }],
    ['/statistics/accepted-christs', { decision: 'ACCEPTED', gender: 'F' }],
    ['/statistics/accepted-christs/charts', { groupBy: 'week', period: 'this_year' }],
    ['/statistics/insights', { year }],
    ['/statistics/attendance/week', { year, week, page: 1, limit: 20 }],
  ];
  for (const [path, params] of simple) {
    await logger.check(`GET ${path} ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', path, { params });
      return `keys=${Object.keys(res.data ?? {}).slice(0, 5).join(',')}`;
    });
  }

  let clubs = [];
  let children = [];
  let teachers = [];
  await logger.check('GET /statistics/clubs todas as páginas', async () => {
    clubs = await fetchAllPages(http.request, 'get', '/statistics/clubs', { year, sortBy: 'clubNumber', sortOrder: 'ASC' }, { limit: 20, maxPages: 50, itemsKey: 'clubs' });
    return `total=${clubs.length}`;
  });
  await logger.check('GET /statistics/children todas as páginas', async () => {
    children = await fetchAllPages(http.request, 'get', '/statistics/children', { year, sortBy: 'name', sortOrder: 'ASC' }, { limit: 50, maxPages: 100, itemsKey: 'children' });
    return `total=${children.length}`;
  });
  await logger.check('GET /statistics/teachers todas as páginas', async () => {
    teachers = await fetchAllPages(http.request, 'get', '/statistics/teachers', { year, isActive: true }, { limit: 20, maxPages: 100, itemsKey: 'teachers' });
    return `total=${teachers.length}`;
  });

  for (const [path, params] of [
    ['/statistics/children', { gender: 'M', ageGroup: '6-10', hasDecision: true, page: 1, limit: 10 }],
    ['/statistics/children', { isNewcomer: true, sortBy: 'engagementScore', sortOrder: 'DESC', page: 1, limit: 10 }],
    ['/statistics/clubs', { weekday: 'saturday', minChildren: 1, page: 1, limit: 10 }],
    ['/statistics/teachers', { minPagelas: 0, sortBy: 'presenceRate', sortOrder: 'DESC', page: 1, limit: 10 }],
  ]) {
    await logger.check(`GET ${path} filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', path, { params });
      const key = path.split('/').pop();
      return `${key}=${res.data?.[key]?.length ?? 0} total=${res.data?.pagination?.total ?? 'n/a'}`;
    });
  }

  const clubId = clubs[0]?.clubId ?? ctx.clubs?.[0]?.id;
  if (clubId) {
    await logger.check(`GET /statistics/attendance/club/${clubId}?year=${year}`, async () => {
      const res = await http.request('get', `/statistics/attendance/club/${clubId}`, { params: { year, page: 1, limit: 20 } });
      return `timeline=${res.data?.timeline?.length ?? 0} missingWeeks=${res.data?.missingWeeks?.length ?? 0}`;
    });
    await logger.check('GET /statistics/attendance/club/:id sem year responde 400/422', () =>
      expectHttpError(() => http.request('get', `/statistics/attendance/club/${clubId}`), [400, 422], 'attendance sem year'),
    );
  }

  await logger.check('GET /statistics/pagelas com gender inválido responde 400/422', () =>
    expectHttpError(() => http.request('get', '/statistics/pagelas', { params: { gender: 'X' } }), [400, 422], 'stats gender'),
  );

  for (const key of ['coordinator', 'teacher']) {
    if (!as[key]) continue;
    await logger.check(`GET /statistics/overview como ${key} responde 403`, () =>
      expectHttpError(() => as[key].request('get', '/statistics/overview'), 403, `stats ${key}`),
    );
  }
  await logger.check('GET /statistics/overview anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/statistics/overview'), 401, 'stats anônimo'),
  );

  return { clubs: clubs.length, children: children.length, teachers: teachers.length };
}

module.exports = { run };
