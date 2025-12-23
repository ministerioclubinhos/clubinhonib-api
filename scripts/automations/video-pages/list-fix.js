async function run({ http, logger }) {
  logger.info('[video-pages/list-fix] listando video-pages...');
  const res = await http.request('get', '/video-pages');
  const items = Array.isArray(res.data) ? res.data : [];
  logger.info(`[video-pages/list-fix] OK total=${items.length}`);
  if (items[0]?.id) {
    await http.request('get', `/video-pages/${items[0].id}`);
    logger.info('[video-pages/list-fix] OK /video-pages/:id');
  }
  return { videoPages: items };
}

module.exports = { run };
