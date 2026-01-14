async function run({ http, logger }) {
  logger.info('[routes/list-fix] listing routes...');
  const res = await http.request('get', '/routes');
  const routes = Array.isArray(res.data) ? res.data : [];
  logger.info(`[routes/list-fix] OK total=${routes.length}`);

  if (routes[0]?.id) {
    await http.request('get', `/routes/${routes[0].id}`);
    logger.info('[routes/list-fix] OK /routes/:id');
  }

  return { routes };
}

module.exports = { run };


