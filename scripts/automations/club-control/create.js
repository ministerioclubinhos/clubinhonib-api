const { ACADEMIC_YEAR } = require('../common/config');

async function ensureAcademicPeriod({ http, year = ACADEMIC_YEAR }) {
  // GET pode retornar null com 200 OK quando não existe período ativo
  let period = null;
  try {
    const res = await http.request('get', `/club-control/periods/${year}`);
    period = res.data;
  } catch (_) {
    period = null;
  }

  if (period && period.startDate && period.endDate) {
    return period;
  }

  // cria (ou reativa) período
  const createRes = await http.request('post', '/club-control/periods', {
    data: {
      year,
      startDate: `${year}-02-03`,
      endDate: `${year}-12-15`,
      description: `Ano Letivo ${year}`,
      isActive: true,
    },
  });
  return createRes.data;
}

async function run({ http, logger }) {
  logger.info(`[club-control/create] garantindo período letivo ${ACADEMIC_YEAR}...`);
  const period = await ensureAcademicPeriod({ http, year: ACADEMIC_YEAR });
  logger.info(`[club-control/create] OK período: ${period?.startDate} -> ${period?.endDate}`);
  return { period };
}

module.exports = { run, ensureAcademicPeriod };


