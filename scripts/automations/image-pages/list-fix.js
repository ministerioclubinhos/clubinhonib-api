const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (logado), detalhe público, seções paginadas (anônimo vê só públicas), edição, remoção 204. */
async function run({ http, logger, ctx }) {
  logger.section('image-pages/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/image-pages', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /image-pages todas as páginas total=${all.length}`);
  for (const params of [{ public: true }, { searchString: 'automação' }, { sort: 'title', order: 'asc' }]) {
    await logger.check(`GET /image-pages filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/image-pages', { params: { ...params, page: 1, limit: 10 } });
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  const mine = ctx.createdImagePages ?? [];
  const sample = mine[0] ?? all[0];
  if (sample) {
    await logger.check(`GET /image-pages/${sample.id} (público)`, async () => {
      const res = await as.anonymous.request('get', `/image-pages/${sample.id}`);
      return `sections=${res.data.sections?.length ?? 0}`;
    });
    await logger.check(`GET /image-pages/${sample.id}/sections paginado (limit=2) e anônimo sem privadas`, async () => {
      const paged = await fetchAllPages(http.request, 'get', `/image-pages/${sample.id}/sections`, {}, { limit: 2, maxPages: 50, itemsKey: 'sections' });
      const anon = await fetchAllPages(as.anonymous.request, 'get', `/image-pages/${sample.id}/sections`, {}, { limit: 2, maxPages: 50, itemsKey: 'sections' });
      if (anon.some((s) => s.public === false)) throw new Error('anônimo viu seção privada');
      if (anon.length > paged.length) throw new Error('anônimo viu mais que o admin');
      return `admin=${paged.length} anônimo=${anon.length}`;
    });
    await logger.check('GET /image-pages/:id/sections com limit acima do teto responde 400/422', () =>
      expectHttpError(() => http.request('get', `/image-pages/${sample.id}/sections`, { params: { limit: 500 } }), [400, 422], 'sections limit'),
    );

    await logger.check(`PATCH /image-pages/${sample.id} mantém seções por id, cria nova com upload e remove uma`, async () => {
      const current = (await http.request('get', `/image-pages/${sample.id}`)).data;
      const sections = current.sections ?? [];
      const kept = sections.slice(0, Math.max(1, sections.length - 1)).map((s) => ({
        id: s.id,
        caption: `${s.caption} (rev.)`,
        description: s.description,
        public: s.public,
        mediaItems: (s.mediaItems ?? s.images ?? []).map((m) => toMediaInput(m)),
      }));
      const up = uploadMedia('jpg', 'gal_new', { title: 'Foto nova' });
      kept.push({ caption: 'Encerramento', description: 'Nova seção', public: true, mediaItems: [up.item, linkMedia({ mediaType: 'image', url: 'https://picsum.photos/seed/fim/400', platformType: 'ANY' })] });
      const payload = { id: sample.id, title: `${current.title} (editada)`, description: current.description, public: true, sections: kept };
      const res = await multipartRequest({ http, method: 'PATCH', path: `/image-pages/${sample.id}`, fields: { imageData: JSON.stringify(payload) }, files: mergeFiles(up) });
      if (!res.data.title.endsWith('(editada)')) throw new Error('PATCH não aplicou title');
      if ((res.data.sections?.length ?? 0) !== kept.length) throw new Error(`esperava ${kept.length} seções, veio ${res.data.sections?.length}`);
      return `sections=${res.data.sections.length}`;
    });
  }

  const disposable = mine[1];
  if (disposable) {
    await logger.check(`DELETE /image-pages/${disposable.id} responde 204`, async () => {
      const res = await http.request('delete', `/image-pages/${disposable.id}`);
      if (res.status !== 204) throw new Error(`status=${res.status}`);
      await expectHttpError(() => http.request('get', `/image-pages/${disposable.id}`), 404, 'galeria removida');
      return 'removida';
    });
  }
  await logger.check('GET /image-pages anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/image-pages'), 401, 'galerias anônimo'),
  );
  return { imagePages: all };
}

module.exports = { run };
