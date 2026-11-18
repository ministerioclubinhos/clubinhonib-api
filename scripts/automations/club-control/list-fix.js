const { ACADEMIC_YEAR } = require('../common/config');
const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorStatus } = require('../common/errors');
const { ensureAcademicPeriod } = require('./create');

async function run({ http, logger, ctx }) {
  logger.section('club-control/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });
  const year = ctx?.year ?? ACADEMIC_YEAR;

  const period = await ensureAcademicPeriod({ http, year });
  if (!period?.startDate || !period?.endDate) throw new Error(`período inválido: ${JSON.stringify(period)}`);
  ctx.period = period;

  await logger.check('PUT /club-control/periods/:id atualiza a descrição', async () => {
    const res = await http.request('put', `/club-control/periods/${period.id}`, { data: { description: `Ano Letivo ${year} (revisado pela automação)`, isActive: true } });
    if (!res.data?.description?.includes('revisado')) throw new Error('descrição não aplicada');
    return res.data.description;
  });

  await logger.check('GET /club-control/periods todas as páginas', async () => {
    const periods = await fetchAllPages(http.request, 'get', '/club-control/periods', {}, { limit: 50, maxPages: 20 });
    if (!periods.some((p) => p.year === year)) throw new Error(`período ${year} não veio na listagem`);
    return `total=${periods.length}`;
  });

  await logger.check(`GET /club-control/periods/${year}`, async () => {
    const res = await http.request('get', `/club-control/periods/${year}`);
    return `startDate=${res.data?.startDate}`;
  });

  await logger.check('GET /club-control/periods/1999 (fora da faixa) responde 400/422', () =>
    expectHttpError(() => http.request('get', '/club-control/periods/1999'), [400, 422], 'ano inválido'),
  );

  await logger.check('GET /club-control/exceptions por intervalo, todas as páginas', async () => {
    const exceptions = await fetchAllPages(http.request, 'get', '/club-control/exceptions', { startDate: `${year}-01-01`, endDate: `${year}-12-31` }, { limit: 50, maxPages: 50 });
    return `total=${exceptions.length}`;
  });

  await logger.check('GET /club-control/exceptions/:date', async () => {
    const date = `${year}-04-21`;
    const res = await http.request('get', `/club-control/exceptions/${date}`);
    return res.data?.id ? `reason=${res.data.reason}` : 'sem exceção nesta data';
  });

  await logger.check('ciclo POST→PATCH→DELETE de exceção descartável', async () => {
    const date = `${year}-06-30`;
    let existing = null;
    try {
      const res = await http.request('get', `/club-control/exceptions/${date}`);
      existing = res.data?.id ? res.data : null;
    } catch (e) {
      if (errorStatus(e) !== 404) throw e;
    }
    const created = existing ?? (await http.request('post', '/club-control/exceptions', { data: { exceptionDate: date, reason: 'Descartável', type: 'other' } })).data;
    const patched = await http.request('patch', `/club-control/exceptions/${created.id}`, { data: { reason: 'Descartável editada', type: 'maintenance', isActive: false } });
    if (patched.data?.reason !== 'Descartável editada') throw new Error('PATCH não aplicou');
    const del = await http.request('delete', `/club-control/exceptions/${created.id}`);
    if (del.data?.success !== true) throw new Error('DELETE sem success=true');
    // A remoção é lógica (isActive=false) e idempotente: repetir responde success de novo.
    const again = await http.request('delete', `/club-control/exceptions/${created.id}`);
    if (again.data?.success !== true) throw new Error('DELETE repetido deveria ser idempotente');
    const after = await http.request('get', `/club-control/exceptions/${date}`);
    if (after.data && typeof after.data === 'object' && after.data.isActive === true) throw new Error('exceção continua ativa após DELETE');
    await expectHttpError(() => http.request('delete', '/club-control/exceptions/00000000-0000-4000-8000-000000000000'), 404, 'delete inexistente');
    return `id=${created.id}`;
  });

  await logger.check('GET /club-control/current-week', async () => {
    const res = await http.request('get', '/club-control/current-week');
    ctx.currentWeek = res.data && typeof res.data === 'object' ? res.data : null;
    return ctx.currentWeek ? `year=${ctx.currentWeek.year} week=${ctx.currentWeek.week}` : 'fora do período letivo (null)';
  });

  await logger.check('GET /club-control/dashboard paginado', async () => {
    const res = await http.request('get', '/club-control/dashboard', { params: { page: 1, limit: 20 } });
    return `totalClubs=${res.data?.summary?.totalClubs ?? 'n/a'}`;
  });

  await logger.check('GET /club-control/check/week (semana atual automática)', async () => {
    const res = await http.request('get', '/club-control/check/week', { params: { page: 1, limit: 50 } });
    return `year=${res.data?.year} week=${res.data?.week} clubs=${res.data?.clubs?.length ?? 0}`;
  });

  const week = ctx.currentWeek?.week ?? 5;
  await logger.check(`GET /club-control/check/week?year=${year}&week=${week}`, async () => {
    const res = await http.request('get', '/club-control/check/week', { params: { year, week, page: 1, limit: 50 } });
    return `clubs=${res.data?.clubs?.length ?? 0} total=${res.data?.summary?.totalClubs ?? 'n/a'}`;
  });

  await logger.check('GET /club-control/check/week só com year responde 400/422', () =>
    expectHttpError(() => http.request('get', '/club-control/check/week', { params: { year } }), [400, 422], 'check/week parcial'),
  );

  const clubId = ctx.clubs?.[0]?.id;
  if (clubId) {
    await logger.check(`GET /club-control/check/club/${clubId}`, async () => {
      const res = await http.request('get', `/club-control/check/club/${clubId}`, { params: { year, week } });
      return `status=${res.data?.status}`;
    });
    await logger.check('GET /club-control/check/club/:id sem year/week responde 400/422', () =>
      expectHttpError(() => http.request('get', `/club-control/check/club/${clubId}`), [400, 422], 'check/club sem semana'),
    );
  }

  await logger.check(`GET /club-control/indicators/detailed?year=${year}&week=${week}`, async () => {
    const res = await http.request('get', '/club-control/indicators/detailed', { params: { year, week, hasProblems: true, page: 1, limit: 20 } });
    return `critical=${res.data?.clubs?.critical?.length ?? 0} warning=${res.data?.clubs?.warning?.length ?? 0}`;
  });

  await logger.check('GET /club-control/indicators/detailed com status inválido responde 400/422', () =>
    expectHttpError(() => http.request('get', '/club-control/indicators/detailed', { params: { year, week, status: 'qualquer' } }), [400, 422], 'indicators status'),
  );

  for (const key of ['coordinator', 'teacher']) {
    if (!as[key]) continue;
    await logger.check(`GET /club-control/dashboard como ${key} responde 403`, () =>
      expectHttpError(() => as[key].request('get', '/club-control/dashboard'), 403, `dashboard ${key}`),
    );
  }
  await logger.check('GET /club-control/current-week anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/club-control/current-week'), 401, 'current-week anônimo'),
  );

  return { period };
}

module.exports = { run };
