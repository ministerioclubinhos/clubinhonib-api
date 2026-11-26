const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (logado) com filtros, semana atual (leitura e publicação), detalhe, edição, remoção. Fix: garante uma página como material da semana. */
async function run({ http, logger, ctx }) {
  logger.section('week-material-pages/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/week-material-pages', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /week-material-pages todas as páginas total=${all.length}`);
  for (const params of [{ currentWeek: true }, { searchString: 'automação' }, { sort: 'title', order: 'asc' }]) {
    await logger.check(`GET /week-material-pages filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/week-material-pages', { params: { ...params, page: 1, limit: 10 } });
      if (params.currentWeek && res.data.data.some((p) => p.currentWeek !== true)) throw new Error('filtro currentWeek vazou');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  const mine = ctx.createdWeekMaterials ?? [];
  const sample = mine[0] ?? all[0];

  await logger.check('GET /week-material-pages/current-week e fix via POST current-week/:id', async () => {
    const cur = await http.request('get', '/week-material-pages/current-week');
    const hasCurrent = cur.data && typeof cur.data === 'object' && cur.data.id;
    if (!hasCurrent && sample) {
      const set = await http.request('post', `/week-material-pages/current-week/${sample.id}`);
      if (set.data.currentWeek !== true) throw new Error('setCurrentWeek não marcou');
      return `definida id=${sample.id}`;
    }
    return hasCurrent ? `atual id=${cur.data.id}` : 'sem páginas';
  });

  if (sample && mine[1]) {
    await logger.check('POST current-week/:id troca a página da semana e desmarca a anterior', async () => {
      await http.request('post', `/week-material-pages/current-week/${mine[1].id}`);
      const [a, b] = await Promise.all([http.request('get', `/week-material-pages/${sample.id}`), http.request('get', `/week-material-pages/${mine[1].id}`)]);
      if (b.data.currentWeek !== true || a.data.currentWeek === true) throw new Error('troca da semana não desmarcou a anterior');
      await http.request('post', `/week-material-pages/current-week/${sample.id}`);
      return 'ok';
    });
  }

  if (sample) {
    await logger.check(`GET /week-material-pages/${sample.id} traz os quatro grupos de mídia`, async () => {
      const res = await http.request('get', `/week-material-pages/${sample.id}`);
      for (const k of ['videos', 'documents', 'images', 'audios']) if (!Array.isArray(res.data[k])) throw new Error(`grupo ausente ${k}`);
      return `v=${res.data.videos.length} d=${res.data.documents.length} i=${res.data.images.length} a=${res.data.audios.length}`;
    });
    await logger.check(`PATCH /week-material-pages/${sample.id} mantém uploads por id, remove um e adiciona pdf`, async () => {
      const current = (await http.request('get', `/week-material-pages/${sample.id}`)).data;
      const pdf = uploadMedia('pdf', 'wm_new_pdf', { title: 'Lição complementar' });
      const payload = {
        id: sample.id,
        pageTitle: `${current.title ?? current.pageTitle} (editada)`,
        pageSubtitle: current.subtitle ?? current.pageSubtitle ?? 'Subtítulo',
        pageDescription: current.description ?? current.pageDescription ?? 'Descrição',
        videos: (current.videos ?? []).filter((v) => v.isLocalFile).map((v) => toMediaInput(v)).concat([linkMedia({ mediaType: 'video' })]),
        documents: (current.documents ?? []).map((d) => toMediaInput(d)).concat([pdf.item]),
        images: (current.images ?? []).map((i) => toMediaInput(i)),
        audios: (current.audios ?? []).map((a) => toMediaInput(a)),
      };
      const res = await multipartRequest({ http, method: 'PATCH', path: `/week-material-pages/${sample.id}`, fields: { weekMaterialsPageData: JSON.stringify(payload) }, files: mergeFiles(pdf) });
      if ((res.data.documents?.length ?? 0) !== payload.documents.length) throw new Error(`documents esperava ${payload.documents.length}, veio ${res.data.documents?.length}`);
      if ((res.data.audios?.length ?? 0) !== payload.audios.length) throw new Error('áudios sumiram na edição');
      return `title="${res.data.title ?? res.data.pageTitle}"`;
    });
  }

  const disposable = mine[2] ?? mine[1];
  if (disposable && disposable.id !== sample?.id) {
    await logger.check(`DELETE /week-material-pages/${disposable.id}`, async () => {
      const res = await http.request('delete', `/week-material-pages/${disposable.id}`);
      await expectHttpError(() => http.request('get', `/week-material-pages/${disposable.id}`), 404, 'página removida');
      return `status=${res.status}`;
    });
  }
  if (as.teacher) {
    await logger.check('GET /week-material-pages e current-week como professor é permitido', async () => {
      const [list, cur] = await Promise.all([as.teacher.request('get', '/week-material-pages', { params: { page: 1, limit: 5 } }), as.teacher.request('get', '/week-material-pages/current-week')]);
      return `data=${list.data.data.length} current=${cur.data?.id ?? 'null'}`;
    });
    if (sample) {
      await logger.check('POST current-week/:id como professor responde 403', () =>
        expectHttpError(() => as.teacher.request('post', `/week-material-pages/current-week/${sample.id}`), 403, 'wm teacher'),
      );
    }
  }
  await logger.check('GET /week-material-pages anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/week-material-pages'), 401, 'wm anônimo'),
  );
  return { weekMaterialPages: all };
}

module.exports = { run };
