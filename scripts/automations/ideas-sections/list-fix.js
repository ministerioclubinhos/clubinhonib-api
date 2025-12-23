async function run({ http, logger }) {
  logger.info('[ideas-sections/list-fix] listando ideas-sections...');
  const res = await http.request('get', '/ideas-sections');
  const items = Array.isArray(res.data) ? res.data : [];
  logger.info(`[ideas-sections/list-fix] OK total=${items.length}`);
  if (items[0]?.id) {
    await http.request('get', `/ideas-sections/${items[0].id}`);
    logger.info('[ideas-sections/list-fix] OK /ideas-sections/:id');
  }
  return { ideasSections: items };
}

module.exports = { run };
