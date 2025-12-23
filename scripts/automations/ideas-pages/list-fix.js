async function run({ http, logger }) {
  logger.info('[ideas-pages/list-fix] listando ideas-pages...');
  const res = await http.request('get', '/ideas-pages');
  const items = Array.isArray(res.data) ? res.data : [];
  logger.info(`[ideas-pages/list-fix] OK total=${items.length}`);
  if (items[0]?.id) {
    await http.request('get', `/ideas-pages/${items[0].id}`);
    logger.info('[ideas-pages/list-fix] OK /ideas-pages/:id');
  }
  return { ideasPages: items };
}

module.exports = { run };
