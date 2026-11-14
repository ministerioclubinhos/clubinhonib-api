const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (logado), detalhe público, edição (seções mantidas por id, nova seção com upload, seção removida), remoção 204. */
async function run({ http, logger, ctx }) {
  logger.section('ideas-pages/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/ideas-pages', { sort: 'createdAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /ideas-pages todas as páginas total=${all.length}`);
  for (const params of [{ public: true }, { searchString: 'automação' }, { sort: 'title', order: 'asc' }]) {
    await logger.check(`GET /ideas-pages filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/ideas-pages', { params: { ...params, page: 1, limit: 10 } });
      if (params.public && res.data.data.some((p) => p.public !== true)) throw new Error('filtro public vazou');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  const mine = ctx.createdIdeasPages ?? [];
  const sample = mine[0] ?? all[0];
  if (sample) {
    await logger.check(`GET /ideas-pages/${sample.id} (público)`, async () => {
      const res = await as.anonymous.request('get', `/ideas-pages/${sample.id}`);
      return `sections=${res.data.sections?.length ?? 0} route=${res.data.route?.path ?? 'n/a'}`;
    });

    await logger.check(`PATCH /ideas-pages/${sample.id} mantém, cria e remove seções`, async () => {
      const current = (await http.request('get', `/ideas-pages/${sample.id}`)).data;
      const sections = current.sections ?? [];
      const kept = sections.slice(0, Math.max(1, sections.length - 1)).map((s) => ({
        id: s.id,
        title: `${s.title} (rev.)`,
        description: s.description,
        public: s.public,
        medias: (s.medias ?? []).map((m) => toMediaInput(m)),
      }));
      const upload = uploadMedia('docx', 'ideas_new_doc', { title: 'Atividade em DOCX' });
      kept.push({ title: 'Seção nova', description: 'Criada na edição', public: true, medias: [upload.item, linkMedia({ mediaType: 'video' })] });
      const payload = { id: sample.id, title: `${current.title} (editada)`, subtitle: current.subtitle, description: current.description, public: true, sections: kept };
      const res = await multipartRequest({ http, method: 'PATCH', path: `/ideas-pages/${sample.id}`, fields: { ideasMaterialsPageData: JSON.stringify(payload) }, files: mergeFiles(upload) });
      if (!res.data.title.endsWith('(editada)')) throw new Error('PATCH não aplicou title');
      if ((res.data.sections?.length ?? 0) !== kept.length) throw new Error(`esperava ${kept.length} seções, veio ${res.data.sections?.length}`);
      const keptMedia = res.data.sections.flatMap((s) => s.medias ?? []).filter((m) => m.isLocalFile);
      if (!keptMedia.length) throw new Error('mídias de upload sumiram na edição');
      return `sections=${res.data.sections.length}`;
    });
  }

  const disposable = mine[1];
  if (disposable) {
    await logger.check(`DELETE /ideas-pages/${disposable.id} responde 204`, async () => {
      const res = await http.request('delete', `/ideas-pages/${disposable.id}`);
      if (res.status !== 204) throw new Error(`status=${res.status}`);
      await expectHttpError(() => http.request('get', `/ideas-pages/${disposable.id}`), 404, 'ideas removida');
      return 'removida';
    });
  }
  if (as.teacher) {
    await logger.check('GET /ideas-pages como professor é permitido', async () => {
      const res = await as.teacher.request('get', '/ideas-pages', { params: { page: 1, limit: 5 } });
      return `data=${res.data.data.length}`;
    });
  }
  await logger.check('GET /ideas-pages anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/ideas-pages'), 401, 'ideas anônimo'),
  );
  return { ideasPages: all };
}

module.exports = { run };
