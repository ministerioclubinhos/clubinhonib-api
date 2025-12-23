const { ACADEMIC_YEAR } = require('../common/config');
const { ensureAcademicPeriod } = require('./create');
const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info(`[club-control/list-fix] validando período letivo ${ACADEMIC_YEAR}...`);
  const period = await ensureAcademicPeriod({ http, year: ACADEMIC_YEAR });
  if (!period?.startDate || !period?.endDate) {
    throw new Error(`[club-control/list-fix] período inválido após ensure: ${JSON.stringify(period)}`);
  }
  logger.info(`[club-control/list-fix] OK período: ${period.startDate} -> ${period.endDate}`);

  // Listar periods (paginado: {items,total})
  try {
    const periods = await fetchAllPages(http.request, 'get', '/club-control/periods', {}, { limit: 50, maxPages: 20 });
    logger.info(`[club-control/list-fix] periods (all pages) total=${periods.length}`);
  } catch (e) {
    logger.warn(`[club-control/list-fix] erro ao listar periods: ${e.response?.data?.message || e.message}`);
  }

  // Listar exceptions (paginado: {items,total})
  try {
    const exceptions = await fetchAllPages(
      http.request,
      'get',
      '/club-control/exceptions',
      { startDate: `${ACADEMIC_YEAR}-01-01`, endDate: `${ACADEMIC_YEAR}-12-31` },
      { limit: 50, maxPages: 50 },
    );
    logger.info(`[club-control/list-fix] exceptions (all pages) total=${exceptions.length}`);
  } catch (e) {
    logger.warn(`[club-control/list-fix] erro ao listar exceptions: ${e.response?.data?.message || e.message}`);
  }

  // Smokes úteis (não paginados)
  try {
    await http.request('get', '/club-control/current-week');
    logger.info('[club-control/list-fix] OK /club-control/current-week');
  } catch (e) {
    logger.warn(`[club-control/list-fix] erro /club-control/current-week: ${e.response?.data?.message || e.message}`);
  }

  try {
    await http.request('get', '/club-control/dashboard');
    logger.info('[club-control/list-fix] OK /club-control/dashboard');
  } catch (e) {
    logger.warn(`[club-control/list-fix] erro /club-control/dashboard: ${e.response?.data?.message || e.message}`);
  }

  try {
    await http.request('get', '/club-control/check/week');
    logger.info('[club-control/list-fix] OK /club-control/check/week');
  } catch (e) {
    logger.warn(`[club-control/list-fix] erro /club-control/check/week: ${e.response?.data?.message || e.message}`);
  }

  try {
    await http.request('get', '/club-control/indicators/detailed');
    logger.info('[club-control/list-fix] OK /club-control/indicators/detailed');
  } catch (e) {
    logger.warn(`[club-control/list-fix] erro /club-control/indicators/detailed: ${e.response?.data?.message || e.message}`);
  }

  return { period };
}

module.exports = { run };


