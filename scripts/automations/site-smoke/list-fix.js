const { expectHttpError } = require('../common/errors');

/**
 * O site como o visitante o vê: rotas públicas respondem sem token e as
 * protegidas recusam com 401.
 */
async function run({ http, logger, ctx }) {
  logger.section('site-smoke/list-fix');
  const anonymous = http.anonymous();

  const publicRoutes = [
    ['/', (d) => typeof d === 'string' || d != null],
    ['/health', (d) => d?.status === 'ok'],
    ['/routes', Array.isArray],
    ['/comments/published', Array.isArray],
    ['/events', Array.isArray],
    ['/events/upcoming', Array.isArray],
    ['/feature-flags/map', (d) => typeof d === 'object'],
    ['/feature-flags/check/statistics', (d) => typeof d?.enabled === 'boolean'],
  ];
  for (const [path, assert] of publicRoutes) {
    await logger.check(`GET ${path} (anônimo)`, async () => {
      const res = await anonymous.request('get', path);
      if (!assert(res.data)) throw new Error(`resposta inesperada: ${JSON.stringify(res.data).slice(0, 80)}`);
      return Array.isArray(res.data) ? `total=${res.data.length}` : 'ok';
    });
  }

  const detailRoutes = [
    ['/documents', ctx.createdDocuments?.[0]?.id],
    ['/image-pages', ctx.createdImagePages?.[0]?.id],
    ['/video-pages', ctx.createdVideoPages?.[0]?.id],
    ['/ideas-pages', ctx.createdIdeasPages?.[0]?.id],
    ['/events', ctx.createdEvents?.[0]?.id],
  ];
  for (const [base, id] of detailRoutes) {
    if (!id) continue;
    await logger.check(`GET ${base}/:id (anônimo)`, async () => {
      const res = await anonymous.request('get', `${base}/${id}`);
      return `id=${res.data?.id}`;
    });
  }
  if (ctx.createdImagePages?.[0]?.id) {
    await logger.check('GET /image-pages/:id/sections (anônimo, paginado)', async () => {
      const res = await anonymous.request('get', `/image-pages/${ctx.createdImagePages[0].id}/sections`, { params: { page: 1, limit: 2 } });
      return `sections=${res.data.sections?.length ?? 0} total=${res.data.total}`;
    });
  }

  const protectedRoutes = ['/users', '/clubs', '/children', '/pagelas', '/statistics/overview', '/club-control/dashboard', '/meditations', '/informatives', '/documents', '/image-pages', '/video-pages', '/ideas-pages', '/week-material-pages', '/profile', '/profiles', '/teacher-profiles', '/coordinator-profiles', '/contact', '/site-feedbacks', '/comments', '/ideas-sections', '/image-sections', '/feature-flags'];
  for (const path of protectedRoutes) {
    await logger.check(`GET ${path} anônimo responde 401`, () => expectHttpError(() => anonymous.request('get', path), 401, path));
  }

  await logger.check('GET /rota-inexistente responde 404', () => expectHttpError(() => anonymous.request('get', '/rota-inexistente'), 404, '404'));
  return { ok: true };
}

module.exports = { run };
