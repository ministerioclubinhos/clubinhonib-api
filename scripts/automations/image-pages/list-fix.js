const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[image-pages/list-fix] listing image-pages...');
  const res = await http.request('get', '/image-pages');
  const items = Array.isArray(res.data) ? res.data : [];
  logger.info(`[image-pages/list-fix] OK total=${items.length}`);

  if (items[0]?.id) {
    const id = items[0].id;
    await http.request('get', `/image-pages/${id}`);
    logger.info('[image-pages/list-fix] OK /image-pages/:id');

    try {
      const sections = await fetchAllPages(http.request, 'get', `/image-pages/${id}/sections`, {}, { limit: 2, maxPages: 50 });
      logger.info(`[image-pages/list-fix] sections totalFetched=${sections.length}`);
    } catch (e) {
      logger.warn(`[image-pages/list-fix] sections paginated failed: ${e.response?.data?.message || e.message}`);
    }
  }

  return { imagePages: items };
}

module.exports = { run };
