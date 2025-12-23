async function run({ http, logger }) {
  logger.info('[informatives/list-fix] listando banners...');
  const res = await http.request('get', '/informatives');
  const items = Array.isArray(res.data) ? res.data : [];
  logger.info(`[informatives/list-fix] OK total=${items.length}`);

  // Fix: garantir public=true no primeiro item
  if (items[0]?.id) {
    const it = items[0];
    if (it.public !== true) {
      try {
        await http.request('patch', `/informatives/${it.id}`, {
          data: { id: it.id, title: it.title, description: it.description, public: true },
        });
        logger.info(`[informatives/list-fix] set public=true id=${it.id}`);
      } catch (e) {
        logger.warn(`[informatives/list-fix] falhou update id=${it.id}: ${e.response?.data?.message || e.message}`);
      }
    }
    await http.request('get', `/informatives/${it.id}`);
    logger.info('[informatives/list-fix] OK /informatives/:id');
  }

  return { informatives: items };
}

module.exports = { run };
