async function run({ http, logger }) {
  logger.info('[events/list-fix] listing events...');
  const res = await http.request('get', '/events');
  const events = Array.isArray(res.data) ? res.data : [];
  logger.info(`[events/list-fix] OK total=${events.length}`);

  const upcoming = await http.request('get', '/events/upcoming');
  const up = Array.isArray(upcoming.data) ? upcoming.data : [];
  logger.info(`[events/list-fix] OK upcoming=${up.length}`);

  if (events[0]?.id) {
    await http.request('get', `/events/${events[0].id}`);
    logger.info('[events/list-fix] OK /events/:id');
  }

  return { events };
}

module.exports = { run };
