const { fetchAllPages } = require('../common/pagination');
const { ACADEMIC_YEAR } = require('../common/config');

async function run({ http, logger }) {
  logger.info('[club-control/list-fix] verificando períodos letivos e exceções cadastradas...');

  // Verifica o período do ano atual
  try {
    const periodRes = await http.request('get', `/club-control/periods/${ACADEMIC_YEAR}`);
    const period = periodRes.data;
    if (period?.startDate && period?.endDate) {
      logger.info(
        `[club-control/list-fix] OK período ${ACADEMIC_YEAR}: ${period.startDate} -> ${period.endDate}`,
      );
    } else {
      logger.warn(`[club-control/list-fix] período ${ACADEMIC_YEAR} sem datas válidas`);
    }
  } catch (e) {
    logger.warn(`[club-control/list-fix] período ${ACADEMIC_YEAR} não encontrado: ${e.response?.data?.message || e.message}`);
  }

  // Lista todas as exceções cadastradas
  try {
    const exceptionsRes = await http.request('get', '/club-control/exceptions', {
      params: { page: 1, limit: 100 },
    });
    const exceptionsData = exceptionsRes.data;
    const exceptions = Array.isArray(exceptionsData)
      ? exceptionsData
      : (exceptionsData?.items || exceptionsData?.data || []);

    logger.info(`[club-control/list-fix] OK exceções cadastradas: ${exceptions.length}`);

    const byType = {};
    for (const exc of exceptions) {
      byType[exc.type] = (byType[exc.type] || 0) + 1;
    }
    const typeSummary = Object.entries(byType).map(([t, c]) => `${t}=${c}`).join(', ');
    if (typeSummary) logger.info(`[club-control/list-fix] exceções por tipo: ${typeSummary}`);
  } catch (e) {
    logger.warn(`[club-control/list-fix] erro ao listar exceções: ${e.response?.data?.message || e.message}`);
  }

  // Smoke test do dashboard
  try {
    const dashRes = await http.request('get', '/club-control/dashboard');
    const dash = dashRes.data;
    logger.info(
      `[club-control/list-fix] OK dashboard: clubsOk=${dash?.summary?.clubsOk ?? 'n/a'} clubsMissing=${dash?.summary?.clubsMissing ?? 'n/a'}`,
    );
  } catch (e) {
    logger.warn(`[club-control/list-fix] dashboard falhou: ${e.response?.data?.message || e.message}`);
  }

  return { ok: true };
}

module.exports = { run };
