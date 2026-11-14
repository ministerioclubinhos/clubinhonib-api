const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { toMediaInput } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Fila de revisão: lista paginada com filtros, contagem, detalhe, aprovação (PATCH public=true) e recusa (delete). */
async function run({ http, logger, ctx }) {
  logger.section('image-sections/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/image-sections', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /image-sections todas as páginas total=${all.length}`);
  for (const params of [{ approved: false }, { approved: true }, { hasMedia: true }, { searchString: 'clubinho' }]) {
    await logger.check(`GET /image-sections filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/image-sections', { params: { ...params, page: 1, limit: 10 } });
      // Aprovada é a publicação que já entrou numa página do feed (pageId), não o flag public.
      if (params.approved === false && res.data.data.some((s) => s.pageId)) throw new Error('approved=false devolveu publicação já aprovada (com pageId)');
      if (params.approved === true && res.data.data.some((s) => !s.pageId)) throw new Error('approved=true devolveu publicação pendente (sem pageId)');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }
  await logger.check('GET /image-sections/pending-count', async () => {
    const res = await http.request('get', '/image-sections/pending-count');
    return `pending=${res.data.pending}`;
  });

  const mine = ctx.createdImageSections ?? [];
  const sample = mine[0] ?? all.find((s) => !s.public);
  if (sample) {
    await logger.check(`GET /image-sections/${sample.id} e PATCH aprova (public=true)`, async () => {
      const one = await http.request('get', `/image-sections/${sample.id}`);
      const items = (one.data.mediaItems ?? one.data.images ?? []).map((m) => toMediaInput(m));
      const res = await multipartRequest({ http, method: 'PATCH', path: `/image-sections/${sample.id}`, fields: { sectionData: JSON.stringify({ caption: `${one.data.caption} (aprovada)`, description: one.data.description, public: true, mediaItems: items }) }, files: {} });
      if (res.data.public !== true) throw new Error('aprovação não aplicou public=true');
      if ((res.data.mediaItems ?? res.data.images ?? []).length !== items.length) throw new Error('fotos sumiram na aprovação');
      return res.data.caption;
    });
  }
  const disposable = mine[1];
  if (disposable) {
    await logger.check(`DELETE /image-sections/${disposable.id} recusa as fotos`, async () => {
      const res = await http.request('delete', `/image-sections/${disposable.id}`);
      await expectHttpError(() => http.request('get', `/image-sections/${disposable.id}`), 404, 'fotos removidas');
      return res.data?.message;
    });
  }
  if (as.teacher) {
    await logger.check('GET /image-sections como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('get', '/image-sections'), 403, 'photos teacher'),
    );
    if (sample) {
      await logger.check('PATCH /image-sections/:id como professor responde 403', () =>
        expectHttpError(() => multipartRequest({ http: as.teacher, method: 'PATCH', path: `/image-sections/${sample.id}`, fields: { sectionData: '{}' }, files: {} }), 403, 'photos patch teacher'),
      );
    }
  }
  return { imageSections: all };
}

module.exports = { run };
