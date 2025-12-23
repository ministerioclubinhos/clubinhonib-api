async function run({ http, logger }) {
  logger.info('[week-material-pages/list-fix] listando week-material-pages...');
  const res = await http.request('get', '/week-material-pages');
  const items = Array.isArray(res.data) ? res.data : [];
  logger.info(`[week-material-pages/list-fix] OK total=${items.length}`);

  try {
    const cur = await http.request('get', '/week-material-pages/current-week');
    logger.info(`[week-material-pages/list-fix] OK current-week id=${cur.data?.id ?? 'n/a'}`);
    // Se não existir, tenta setar a primeira página como current-week
    if (!cur.data?.id && items[0]?.id) {
      await http.request('post', `/week-material-pages/current-week/${items[0].id}`);
      logger.info(`[week-material-pages/list-fix] set current-week id=${items[0].id}`);
    }
  } catch (e) {
    logger.warn(`[week-material-pages/list-fix] current-week falhou: ${e.response?.data?.message || e.message}`);
  }

  if (items[0]?.id) {
    await http.request('get', `/week-material-pages/${items[0].id}`);
    logger.info('[week-material-pages/list-fix] OK /week-material-pages/:id');
  }
  return { weekMaterialPages: items };
}

module.exports = { run };
