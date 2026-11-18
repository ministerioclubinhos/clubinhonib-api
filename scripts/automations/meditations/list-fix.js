const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (logado) com filtros, semana atual, detalhe, edição (tema e arquivo novo), remoção 204. */
async function run({ http, logger, ctx }) {
  logger.section('meditations/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/meditations', { sort: 'startDate', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /meditations todas as páginas total=${all.length}`);

  for (const params of [{ period: 'upcoming' }, { period: 'past' }, { period: 'current' }, { searchString: 'João' }, { sort: 'topic', order: 'asc' }]) {
    await logger.check(`GET /meditations filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/meditations', { params: { ...params, page: 1, limit: 10 } });
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  await logger.check('GET /meditations/this-week', async () => {
    const res = await http.request('get', '/meditations/this-week');
    return res.data && typeof res.data === 'object' ? `topic=${res.data.topic}` : 'nenhuma nesta semana (null)';
  });

  const mine = ctx.createdMeditations ?? [];
  const sample = mine[0] ?? all[0];
  if (sample) {
    await logger.check(`GET/PATCH /meditations/${sample.id} (tema e dias)`, async () => {
      const one = await http.request('get', `/meditations/${sample.id}`);
      const days = (one.data.days ?? []).map((d) => ({ day: d.day, verse: d.verse, topic: `${d.topic} (rev.)` }));
      const res = await multipartRequest({ http, method: 'PATCH', path: `/meditations/${sample.id}`, fields: { meditationData: JSON.stringify({ id: sample.id, topic: `${one.data.topic} (editada)`, days }) }, files: {} });
      if (!res.data.topic.endsWith('(editada)')) throw new Error('PATCH não aplicou topic');
      if (!res.data.days?.[0]?.topic?.endsWith('(rev.)')) throw new Error('PATCH não substituiu os dias');
      return res.data.topic;
    });
    await logger.check(`PATCH /meditations/${sample.id} com áudio novo`, async () => {
      const res = await multipartRequest({
        http,
        method: 'PATCH',
        path: `/meditations/${sample.id}`,
        fields: { meditationData: JSON.stringify({ media: { title: 'Áudio regravado', description: 'upload novo', uploadType: 'upload', mediaType: 'audio', isLocalFile: true } }) },
        files: { file: fixture('mp3', { name: 'meditacao-regravada.mp3' }) },
      });
      if (!res.data.media?.url) throw new Error('resposta sem media.url');
      return res.data.media.url.split('/').pop();
    });
  }

  const disposable = mine[1];
  if (disposable) {
    await logger.check(`DELETE /meditations/${disposable.id} responde 204`, async () => {
      const res = await http.request('delete', `/meditations/${disposable.id}`);
      if (res.status !== 204) throw new Error(`status=${res.status}`);
      await expectHttpError(() => http.request('get', `/meditations/${disposable.id}`), 404, 'meditação removida');
      return 'removida';
    });
  }

  if (as.teacher) {
    await logger.check('GET /meditations como professor é permitido', async () => {
      const res = await as.teacher.request('get', '/meditations', { params: { page: 1, limit: 5 } });
      return `data=${res.data.data.length}`;
    });
    if (sample) {
      await logger.check('DELETE /meditations/:id como professor responde 403', () =>
        expectHttpError(() => as.teacher.request('delete', `/meditations/${sample.id}`), 403, 'meditação teacher'),
      );
    }
  }
  await logger.check('GET /meditations anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/meditations'), 401, 'meditações anônimo'),
  );
  return { meditations: all };
}

module.exports = { run };
