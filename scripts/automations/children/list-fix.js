const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[children/list-fix] listando todas as crianças...');
  const children = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100, maxPages: 500 });
  logger.info(`[children/list-fix] OK total=${children.length}`);

  // Resumo por clube
  const byClub = {};
  let withoutClub = 0;
  let inactive = 0;

  for (const child of children) {
    const clubId = child.clubId || child.club?.id;
    if (clubId) {
      byClub[clubId] = (byClub[clubId] || 0) + 1;
    } else {
      withoutClub++;
    }
    if (!child.isActive) inactive++;
  }

  logger.info(`[children/list-fix] semClube=${withoutClub} inativas=${inactive} clubes=${Object.keys(byClub).length}`);
  return { children, withoutClub, inactive };
}

module.exports = { run };
