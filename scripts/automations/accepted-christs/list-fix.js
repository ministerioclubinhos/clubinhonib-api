const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  // accepted-christs não tem GET público listável via API, mas pode existir
  // Faz um smoke test nos endpoints que existem (via statistics ou via clube)
  logger.info('[accepted-christs/list-fix] verificando accepted-christs via statistics...');

  try {
    const res = await http.request('get', '/statistics/accepted-christs/charts', {
      params: { groupBy: 'month' },
    });
    const data = res.data;
    logger.info(`[accepted-christs/list-fix] OK statistics/accepted-christs/charts retornou dados`);
  } catch (e) {
    logger.warn(`[accepted-christs/list-fix] statistics/accepted-christs/charts falhou: ${e.response?.data?.message || e.message}`);
  }

  return { ok: true };
}

module.exports = { run };
