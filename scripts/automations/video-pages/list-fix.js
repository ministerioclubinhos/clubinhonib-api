const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (logado), detalhe público, edição (mantém por id, troca um, adiciona upload), remoção 204. */
async function run({ http, logger, ctx }) {
  logger.section('video-pages/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/video-pages', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /video-pages todas as páginas total=${all.length}`);
  for (const params of [{ public: true }, { searchString: 'automação' }]) {
    await logger.check(`GET /video-pages filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/video-pages', { params: { ...params, page: 1, limit: 10 } });
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  const mine = ctx.createdVideoPages ?? [];
  const sample = mine[0] ?? all[0];
  if (sample) {
    await logger.check(`GET /video-pages/${sample.id} (público)`, async () => {
      const res = await as.anonymous.request('get', `/video-pages/${sample.id}`);
      return `videos=${res.data.videos?.length ?? 0}`;
    });
    await logger.check(`PATCH /video-pages/${sample.id} mantém uploads, remove um link e adiciona mp4`, async () => {
      const current = (await http.request('get', `/video-pages/${sample.id}`)).data;
      const videos = current.videos ?? [];
      const kept = videos.filter((v, i) => v.isLocalFile || i > 0).map((v) => toMediaInput(v, { title: `${v.title ?? 'Vídeo'} (rev.)` }));
      const mp4 = uploadMedia('mp4', 'video_new', { title: 'Vídeo novo' });
      const payload = { id: sample.id, title: `${current.title} (editada)`, description: current.description, public: true, videos: [...kept, mp4.item, linkMedia({ mediaType: 'video' })] };
      const res = await multipartRequest({ http, method: 'PATCH', path: `/video-pages/${sample.id}`, fields: { videosPageData: JSON.stringify(payload) }, files: mergeFiles(mp4) });
      if ((res.data.videos?.length ?? 0) !== payload.videos.length) throw new Error(`esperava ${payload.videos.length} vídeos, veio ${res.data.videos?.length}`);
      const uploads = res.data.videos.filter((v) => v.isLocalFile);
      if (uploads.length < 2) throw new Error('uploads não preservados/adicionados');
      return `videos=${res.data.videos.length} uploads=${uploads.length}`;
    });
    await logger.check('PATCH /video-pages/:id sem id no corpo responde 400/422', () =>
      expectHttpError(() => multipartRequest({ http, method: 'PATCH', path: `/video-pages/${sample.id}`, fields: { videosPageData: JSON.stringify({ title: 'x', description: 'y', public: true, videos: [] }) }, files: {} }), [400, 422], 'videos sem id'),
    );
  }

  const disposable = mine[1];
  if (disposable) {
    await logger.check(`DELETE /video-pages/${disposable.id} responde 204`, async () => {
      const res = await http.request('delete', `/video-pages/${disposable.id}`);
      if (res.status !== 204) throw new Error(`status=${res.status}`);
      await expectHttpError(() => http.request('get', `/video-pages/${disposable.id}`), 404, 'página removida');
      return 'removida';
    });
  }
  await logger.check('GET /video-pages anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/video-pages'), 401, 'videos anônimo'),
  );
  return { videoPages: all };
}

module.exports = { run };
