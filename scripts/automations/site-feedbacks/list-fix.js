const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (admin) com filtros, contagem, detalhe, edição, lido/não lido, remoção. Fix: marca como lidos os da automação. */
async function run({ http, logger, ctx }) {
  logger.section('site-feedbacks/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/site-feedbacks', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /site-feedbacks todas as páginas total=${all.length}`);

  for (const params of [{ read: false }, { category: 'usability' }, { rating: 5 }, { searchString: 'automação' }]) {
    await logger.check(`GET /site-feedbacks filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/site-feedbacks', { params: { ...params, page: 1, limit: 10 } });
      if (params.rating && res.data.data.some((f) => f.rating !== params.rating)) throw new Error('filtro rating vazou');
      if (params.category && res.data.data.some((f) => f.category !== params.category)) throw new Error('filtro category vazou');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  await logger.check('GET /site-feedbacks/unread-count', async () => {
    const res = await http.request('get', '/site-feedbacks/unread-count');
    return `unread=${res.data?.unread}`;
  });

  let marked = 0;
  for (const f of ctx.createdFeedbacks ?? []) {
    if (!f?.id) continue;
    await http.request('patch', `/site-feedbacks/${f.id}/read`);
    marked++;
  }
  logger.ok(`[site-feedbacks/list-fix] marcados como lidos=${marked}`);

  const sample = (ctx.createdFeedbacks ?? [])[0] ?? all[0];
  if (sample) {
    await logger.check(`GET/PUT /site-feedbacks/${sample.id} e unread/read`, async () => {
      const one = await http.request('get', `/site-feedbacks/${sample.id}`);
      const upd = await http.request('put', `/site-feedbacks/${sample.id}`, { data: { rating: 4, comment: `${one.data.comment} (revisado)`, category: 'suggestion' } });
      if (upd.data.rating !== 4 || upd.data.category !== 'suggestion') throw new Error('PUT não aplicou');
      const unread = await http.request('patch', `/site-feedbacks/${sample.id}/unread`);
      if (unread.data.read !== false) throw new Error('unread não aplicou');
      await http.request('patch', `/site-feedbacks/${sample.id}/read`);
      return one.data.email;
    });
  }

  const disposable = (ctx.createdFeedbacks ?? [])[1];
  if (disposable) {
    await logger.check(`DELETE /site-feedbacks/${disposable.id}`, async () => {
      const del = await http.request('delete', `/site-feedbacks/${disposable.id}`);
      await expectHttpError(() => http.request('get', `/site-feedbacks/${disposable.id}`), 404, 'feedback removido');
      return del.data?.message ?? 'removido';
    });
  }

  if (as.teacher) {
    await logger.check('GET /site-feedbacks como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('get', '/site-feedbacks'), 403, 'feedbacks teacher'),
    );
  }
  await logger.check('GET /site-feedbacks anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/site-feedbacks'), 401, 'feedbacks anônimo'),
  );

  return { feedbacks: all, marked };
}

module.exports = { run };
