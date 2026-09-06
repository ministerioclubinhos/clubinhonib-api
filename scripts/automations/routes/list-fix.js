const { expectHttpError } = require('../common/errors');

/** `GET /routes` e `GET /routes/:id` são públicos. */
async function run({ http, logger }) {
  logger.section('routes/list-fix');
  const anonymous = http.anonymous();
  let routes = [];
  await logger.check('GET /routes (público) lista as rotas', async () => {
    const res = await anonymous.request('get', '/routes');
    if (!Array.isArray(res.data)) throw new Error('esperava array');
    routes = res.data;
    const byType = routes.reduce((acc, r) => ({ ...acc, [r.entityType ?? r.type ?? '?']: (acc[r.entityType ?? r.type ?? '?'] ?? 0) + 1 }), {});
    return `total=${routes.length} porTipo=${JSON.stringify(byType)}`;
  });
  if (routes[0]?.id) {
    await logger.check(`GET /routes/${routes[0].id}`, async () => {
      const res = await anonymous.request('get', `/routes/${routes[0].id}`);
      return `path=${res.data?.path}`;
    });
  }
  await logger.check('GET /routes/:id inexistente responde 404', () =>
    expectHttpError(() => anonymous.request('get', '/routes/00000000-0000-4000-8000-000000000000'), 404, 'rota inexistente'),
  );
  return { routes };
}

module.exports = { run };
