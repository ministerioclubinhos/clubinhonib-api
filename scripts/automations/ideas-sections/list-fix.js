const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { toMediaInput, linkMedia } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Fila da administração: lista paginada, contagem, detalhe, edição, publicação numa página (attach) e recusa (delete). */
async function run({ http, logger, ctx }) {
  logger.section('ideas-sections/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const pending = await fetchAllPages(http.request, 'get', '/ideas-sections', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /ideas-sections (fila) todas as páginas total=${pending.length}`);
  await logger.check('GET /ideas-sections/pending-count bate com a fila', async () => {
    const res = await http.request('get', '/ideas-sections/pending-count');
    if (res.data.pending !== pending.length) throw new Error(`pending=${res.data.pending} fila=${pending.length}`);
    return `pending=${res.data.pending}`;
  });
  await logger.check('GET /ideas-sections filtro searchString', async () => {
    const res = await http.request('get', '/ideas-sections', { params: { searchString: 'compartilhada', page: 1, limit: 10 } });
    return `data=${res.data.data.length}`;
  });

  const mine = ctx.createdIdeaSections ?? [];
  const sample = mine[0] ?? pending[0];
  if (sample) {
    await logger.check(`GET/PATCH /ideas-sections/${sample.id}`, async () => {
      const one = await http.request('get', `/ideas-sections/${sample.id}`);
      const medias = (one.data.medias ?? []).map((m) => toMediaInput(m));
      const res = await multipartRequest({ http, method: 'PATCH', path: `/ideas-sections/${sample.id}`, fields: { sectionData: JSON.stringify({ title: `${one.data.title} (revisada)`, description: one.data.description, public: false, medias }) }, files: {} });
      if (!res.data.title.endsWith('(revisada)')) throw new Error('PATCH não aplicou');
      if ((res.data.medias?.length ?? 0) !== medias.length) throw new Error('mídias sumiram na edição');
      return res.data.title;
    });
  }

  const page = (ctx.createdIdeasPages ?? [])[0] ?? (await http.request('get', '/ideas-pages', { params: { page: 1, limit: 1 } })).data.data?.[0];
  const toAttach = mine[1] ?? pending.find((s) => s.id !== sample?.id);
  if (page && toAttach) {
    await logger.check(`PATCH /ideas-sections/${toAttach.id}/attach/${page.id} publica a ideia na página`, async () => {
      const one = await http.request('get', `/ideas-sections/${toAttach.id}`);
      const medias = [...(one.data.medias ?? []).map((m) => toMediaInput(m)), linkMedia({ mediaType: 'video' })];
      const res = await multipartRequest({ http, method: 'PATCH', path: `/ideas-sections/${toAttach.id}/attach/${page.id}`, fields: { sectionData: JSON.stringify({ title: one.data.title, description: one.data.description, public: true, medias }) }, files: {} });
      const pageAfter = await http.request('get', `/ideas-pages/${page.id}`);
      if (!pageAfter.data.sections?.some((s) => s.id === toAttach.id)) throw new Error('seção não apareceu na página');
      const count = await http.request('get', '/ideas-sections/pending-count');
      return `public=${res.data.public} pendingAgora=${count.data.pending}`;
    });
    await logger.check('attach repetido responde 409/400', () =>
      expectHttpError(() => multipartRequest({ http, method: 'PATCH', path: `/ideas-sections/${toAttach.id}/attach/${page.id}`, fields: { sectionData: JSON.stringify({ title: 'x', description: 'y', medias: [] }) }, files: {} }), [400, 404, 409], 'attach repetido'),
    );
  }

  const disposable = mine[2];
  if (disposable) {
    await logger.check(`DELETE /ideas-sections/${disposable.id} recusa a ideia`, async () => {
      const res = await http.request('delete', `/ideas-sections/${disposable.id}`);
      await expectHttpError(() => http.request('get', `/ideas-sections/${disposable.id}`), 404, 'ideia removida');
      return res.data?.message;
    });
  }
  if (as.teacher) {
    await logger.check('GET /ideas-sections como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('get', '/ideas-sections'), 403, 'ideas-sections teacher'),
    );
  }
  return { pending };
}

module.exports = { run };
