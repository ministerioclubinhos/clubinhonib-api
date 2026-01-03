const { fetchAllPages } = require('../common/pagination');
const { ACADEMIC_YEAR } = require('../common/config');

async function run({ http, logger }) {
  logger.info('[statistics/list-fix] smoke dos principais endpoints...');

  // Overview
  await http.request('get', '/statistics/overview');
  logger.info('[statistics/list-fix] OK /statistics/overview');

  // Charts (sem filtros)
  await http.request('get', '/statistics/pagelas/charts', { params: { year: ACADEMIC_YEAR, groupBy: 'month' } });
  logger.info('[statistics/list-fix] OK /statistics/pagelas/charts');

  await http.request('get', '/statistics/accepted-christs/charts', { params: { groupBy: 'month' } });
  logger.info('[statistics/list-fix] OK /statistics/accepted-christs/charts');

  // Insights (leve)
  await http.request('get', '/statistics/insights', { params: { year: ACADEMIC_YEAR } });
  logger.info('[statistics/list-fix] OK /statistics/insights');

  // Endpoints paginados (pegar todas as páginas quando existir meta)
  const clubs = await fetchAllPages(http.request, 'get', '/statistics/clubs', { page: 1, limit: 20 }, { limit: 20, maxPages: 50 });
  logger.info(`[statistics/list-fix] OK /statistics/clubs totalItemsFetched=${clubs.length}`);

  const children = await fetchAllPages(http.request, 'get', '/statistics/children', { page: 1, limit: 20 }, { limit: 20, maxPages: 50 });
  logger.info(`[statistics/list-fix] OK /statistics/children totalItemsFetched=${children.length}`);

  const teachers = await fetchAllPages(http.request, 'get', '/statistics/teachers', { page: 1, limit: 20 }, { limit: 20, maxPages: 50 });
  logger.info(`[statistics/list-fix] OK /statistics/teachers totalItemsFetched=${teachers.length}`);

  // Chamadas detalhadas (1 item) quando possível
  if (Array.isArray(clubs) && clubs[0]?.id) {
    await http.request('get', `/statistics/clubs/${clubs[0].id}`, { params: { year: ACADEMIC_YEAR } });
    logger.info('[statistics/list-fix] OK /statistics/clubs/:clubId');
  }

  if (Array.isArray(children) && children[0]?.id) {
    await http.request('get', `/statistics/children/${children[0].id}`);
    logger.info('[statistics/list-fix] OK /statistics/children/:childId');
  }

  if (Array.isArray(teachers) && teachers[0]?.id) {
    await http.request('get', `/statistics/teachers/${teachers[0].id}`, { params: { year: ACADEMIC_YEAR } });
    logger.info('[statistics/list-fix] OK /statistics/teachers/:teacherId');
  }

  return { ok: true };
}

module.exports = { run };


