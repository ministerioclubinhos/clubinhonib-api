const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (qualquer papel logado), filtros, detalhe, edição (PATCH sem id no corpo), remoção 204. */
async function run({ http, logger, ctx }) {
  logger.section('informatives/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/informatives', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /informatives todas as páginas total=${all.length}`);

  for (const params of [{ public: true }, { searchString: 'automação' }]) {
    await logger.check(`GET /informatives filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/informatives', { params: { ...params, page: 1, limit: 10 } });
      if (params.public && res.data.data.some((i) => i.public !== true)) throw new Error('filtro public vazou');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  const sample = (ctx.createdInformatives ?? [])[0] ?? all[0];
  if (sample) {
    await logger.check(`GET/PATCH /informatives/${sample.id}`, async () => {
      const one = await http.request('get', `/informatives/${sample.id}`);
      const upd = await http.request('patch', `/informatives/${sample.id}`, { data: { title: `${one.data.title} (editado)`, description: one.data.description, public: true } });
      if (!upd.data.title.endsWith('(editado)') || upd.data.public !== true) throw new Error('PATCH não aplicou');
      return upd.data.title;
    });
    await logger.check('PATCH /informatives/:id com id no corpo responde 400/422 (whitelist)', () =>
      expectHttpError(() => http.request('patch', `/informatives/${sample.id}`, { data: { id: sample.id, title: 'x', description: 'y', public: true } }), [400, 422], 'informative whitelist'),
    );
  }

  const disposable = (ctx.createdInformatives ?? [])[1];
  if (disposable) {
    await logger.check(`DELETE /informatives/${disposable.id} responde 204`, async () => {
      const del = await http.request('delete', `/informatives/${disposable.id}`);
      if (del.status !== 204) throw new Error(`status=${del.status}`);
      await expectHttpError(() => http.request('get', `/informatives/${disposable.id}`), 404, 'informative removido');
      return 'removido';
    });
  }

  if (as.teacher) {
    await logger.check('GET /informatives como professor é permitido', async () => {
      const res = await as.teacher.request('get', '/informatives', { params: { page: 1, limit: 5 } });
      return `data=${res.data.data.length}`;
    });
    if (sample) {
      await logger.check('PATCH /informatives/:id como professor responde 403', () =>
        expectHttpError(() => as.teacher.request('patch', `/informatives/${sample.id}`, { data: { title: 'x', description: 'y', public: true } }), 403, 'informative teacher'),
      );
    }
  }
  await logger.check('GET /informatives anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/informatives'), 401, 'informatives anônimo'),
  );

  return { informatives: all };
}

module.exports = { run };
