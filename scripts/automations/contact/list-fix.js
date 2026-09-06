const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (admin) com filtros, contagem, detalhe, lido/não lido, remoção. Fix: marca como lidos os contatos da automação. */
async function run({ http, logger, ctx }) {
  logger.section('contact/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/contact', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /contact todas as páginas total=${all.length}`);

  for (const params of [{ read: false }, { searchString: 'Clubinho' }]) {
    await logger.check(`GET /contact filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/contact', { params: { ...params, page: 1, limit: 10 } });
      if (params.read === false && res.data.data.some((c) => c.read)) throw new Error('filtro read vazou');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  await logger.check('GET /contact/unread-count', async () => {
    const res = await http.request('get', '/contact/unread-count');
    return `unread=${res.data?.unread}`;
  });

  let marked = 0;
  for (const c of ctx.createdContacts ?? []) {
    if (!c?.id) continue;
    await http.request('patch', `/contact/${c.id}/read`);
    marked++;
  }
  logger.ok(`[contact/list-fix] marcados como lidos=${marked}`);

  const sample = (ctx.createdContacts ?? [])[0] ?? all[0];
  if (sample) {
    await logger.check(`GET /contact/${sample.id} e unread/read`, async () => {
      const one = await http.request('get', `/contact/${sample.id}`);
      const unread = await http.request('patch', `/contact/${sample.id}/unread`);
      if (unread.data.read !== false) throw new Error('unread não aplicou');
      const read = await http.request('patch', `/contact/${sample.id}/read`);
      if (read.data.read !== true) throw new Error('read não aplicou');
      return one.data.email;
    });
  }

  const disposable = (ctx.createdContacts ?? [])[1];
  if (disposable) {
    await logger.check(`DELETE /contact/${disposable.id}`, async () => {
      const del = await http.request('delete', `/contact/${disposable.id}`);
      await expectHttpError(() => http.request('get', `/contact/${disposable.id}`), 404, 'contato removido');
      return del.data?.message ?? 'removido';
    });
  }

  if (as.coordinator) {
    await logger.check('GET /contact como coordenador responde 403', () =>
      expectHttpError(() => as.coordinator.request('get', '/contact'), 403, 'contact coord'),
    );
  }
  await logger.check('GET /contact anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/contact'), 401, 'contact anônimo'),
  );

  return { contacts: all, marked };
}

module.exports = { run };
