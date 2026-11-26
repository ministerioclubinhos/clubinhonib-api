const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/**
 * Listagem paginada (admin) com filtros, contagem de pendentes, detalhe,
 * edição, publicar/despublicar, remoção e a lista pública.
 * Fix: garante pelo menos um comentário publicado para a home.
 */
async function run({ http, logger, ctx }) {
  logger.section('comments/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/comments', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /comments todas as páginas total=${all.length}`);

  for (const params of [{ published: false }, { published: true }, { searchString: 'Clubinho' }]) {
    await logger.check(`GET /comments filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/comments', { params: { ...params, page: 1, limit: 10 } });
      if (typeof params.published === 'boolean' && res.data.data.some((c) => c.published !== params.published)) throw new Error('filtro published vazou');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  await logger.check('GET /comments/unpublished-count', async () => {
    const res = await http.request('get', '/comments/unpublished-count');
    if (typeof res.data?.unpublished !== 'number') throw new Error('contrato { unpublished }');
    return `unpublished=${res.data.unpublished}`;
  });

  // Fix + ciclo: publica os comentários criados pela automação (metade), edita um, despublica/republica.
  let published = 0;
  const mine = (ctx.createdComments ?? []).filter((c) => c?.id);
  for (const [i, c] of mine.entries()) {
    if (i % 2 === 1) continue;
    await http.request('patch', `/comments/${c.id}/publish`);
    published++;
  }
  const publishedList = await http.request('get', '/comments/published');
  if (!Array.isArray(publishedList.data) || publishedList.data.length === 0) {
    const first = all[0] ?? mine[0];
    if (first) {
      await http.request('patch', `/comments/${first.id}/publish`);
      published++;
    }
  }
  logger.ok(`[comments/list-fix] publicados=${published}`);

  const sample = mine[0] ?? all[0];
  if (sample) {
    await logger.check(`GET/PUT/PATCH /comments/${sample.id}`, async () => {
      const one = await http.request('get', `/comments/${sample.id}`);
      const upd = await http.request('put', `/comments/${sample.id}`, { data: { comment: `${one.data.comment} (revisado)`, published: true } });
      if (!upd.data.comment.endsWith('(revisado)') || upd.data.published !== true) throw new Error('PUT não aplicou');
      const un = await http.request('patch', `/comments/${sample.id}/unpublish`);
      if (un.data.published !== false) throw new Error('unpublish não aplicou');
      const re = await http.request('patch', `/comments/${sample.id}/publish`);
      if (re.data.published !== true) throw new Error('publish não aplicou');
      return one.data.name;
    });
  }

  await logger.check('GET /comments/published (público) só traz publicados', async () => {
    const res = await as.anonymous.request('get', '/comments/published');
    if (!Array.isArray(res.data)) throw new Error('esperava array');
    if (res.data.some((c) => c.published === false)) throw new Error('vazou comentário despublicado');
    return `published=${res.data.length}`;
  });

  await logger.check('DELETE /comments/:id remove um comentário descartável', async () => {
    const created = await http.request('post', '/comments', { data: { name: 'Descartável', comment: 'Será removido', clubinho: 'Clubinho 0', neighborhood: 'Centro' } });
    const del = await http.request('delete', `/comments/${created.data.id}`);
    await expectHttpError(() => http.request('get', `/comments/${created.data.id}`), 404, 'comentário removido');
    return del.data?.message ?? 'removido';
  });

  if (as.teacher) {
    await logger.check('GET /comments como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('get', '/comments'), 403, 'comments teacher'),
    );
    if (sample) {
      await logger.check('PATCH /comments/:id/publish como professor responde 403', () =>
        expectHttpError(() => as.teacher.request('patch', `/comments/${sample.id}/publish`), 403, 'publish teacher'),
      );
    }
  }
  await logger.check('GET /comments anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/comments'), 401, 'comments anônimo'),
  );

  return { comments: all, published };
}

module.exports = { run };
