async function run({ http, logger }) {
  logger.info('[meditations/list-fix] listando meditações...');
  const res = await http.request('get', '/meditations');
  const raw = Array.isArray(res.data) ? res.data : [];
  const items = raw.map((x) => x?.meditation || x).filter(Boolean);
  logger.info(`[meditations/list-fix] OK total=${items.length}`);

  try {
    await http.request('get', '/meditations/this-week');
    logger.info('[meditations/list-fix] OK /meditations/this-week');
  } catch (e) {
    logger.warn(`[meditations/list-fix] this-week falhou: ${e.response?.data?.message || e.message}`);
  }

  if (items[0]?.id) {
    await http.request('get', `/meditations/${items[0].id}`);
    logger.info('[meditations/list-fix] OK /meditations/:id');
  }

  return { meditations: items };
}

module.exports = { run };
