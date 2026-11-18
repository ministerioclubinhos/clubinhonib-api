const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Listagem paginada (logado) com filtros, detalhe público, edição com e sem arquivo novo, remoção 204. */
async function run({ http, logger, ctx }) {
  logger.section('documents/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/documents', { sort: 'name', order: 'ASC' }, { limit: 50 });
  logger.ok(`GET /documents todas as páginas total=${all.length}`);
  const semMidia = all.filter((d) => !d.media);
  if (semMidia.length) logger.warn(`[documents/list-fix] documentos sem mídia: ${semMidia.length}`);

  for (const params of [{ hasMedia: true }, { hasMedia: false }, { searchString: 'automação' }]) {
    await logger.check(`GET /documents filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/documents', { params: { ...params, page: 1, limit: 10 } });
      if (params.hasMedia === true && res.data.data.some((d) => !d.media)) throw new Error('hasMedia=true devolveu documento sem mídia');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  const mine = ctx.createdDocuments ?? [];
  const sample = mine[0] ?? all[0];
  if (sample) {
    await logger.check(`GET /documents/${sample.id} é público`, async () => {
      const res = await as.anonymous.request('get', `/documents/${sample.id}`);
      return `route=${res.data?.route?.path ?? 'n/a'}`;
    });

    await logger.check(`PATCH /documents/${sample.id} troca descrição mantendo o arquivo`, async () => {
      const current = (await http.request('get', `/documents/${sample.id}`)).data;
      const documentData = {
        id: sample.id,
        name: current.name,
        description: `${current.description ?? ''} (verificado pela automação)`,
        media: {
          id: current.media?.id,
          title: current.media?.title,
          description: current.media?.description,
          uploadType: current.media?.uploadType,
          mediaType: 'document',
          isLocalFile: current.media?.isLocalFile,
          url: current.media?.url,
          platformType: current.media?.platformType ?? undefined,
          fileField: 'docFile',
        },
      };
      const res = await multipartRequest({ http, method: 'PATCH', path: `/documents/${sample.id}`, fields: { documentData: JSON.stringify(documentData) }, files: {} });
      if (res.data.media?.url !== current.media?.url) throw new Error('arquivo foi trocado sem upload novo');
      return res.data.description;
    });

    await logger.check(`PATCH /documents/${sample.id} com arquivo novo (PDF)`, async () => {
      const current = (await http.request('get', `/documents/${sample.id}`)).data;
      const documentData = {
        id: sample.id,
        name: `${current.name}`,
        description: current.description,
        media: { title: 'Versão revisada', description: 'Upload novo', uploadType: 'upload', mediaType: 'document', isLocalFile: true, fileField: 'docFile' },
      };
      const res = await multipartRequest({ http, method: 'PATCH', path: `/documents/${sample.id}`, fields: { documentData: JSON.stringify(documentData) }, files: { docFile: fixture('pdf', { title: 'Versão revisada' }) } });
      if (res.data.media?.url === current.media?.url) throw new Error('url não mudou após upload novo');
      return res.data.media.url.split('/').pop();
    });
  }

  const disposable = mine[1];
  if (disposable) {
    await logger.check(`DELETE /documents/${disposable.id} responde 204`, async () => {
      const res = await http.request('delete', `/documents/${disposable.id}`);
      if (res.status !== 204) throw new Error(`status=${res.status}`);
      await expectHttpError(() => http.request('get', `/documents/${disposable.id}`), 404, 'documento removido');
      return 'removido';
    });
  }

  await logger.check('GET /documents anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/documents'), 401, 'documents anônimo'),
  );
  if (as.teacher) {
    await logger.check('GET /documents como professor é permitido', async () => {
      const res = await as.teacher.request('get', '/documents', { params: { page: 1, limit: 5 } });
      return `data=${res.data.data.length}`;
    });
    if (sample) {
      await logger.check('DELETE /documents/:id como professor responde 403', () =>
        expectHttpError(() => as.teacher.request('delete', `/documents/${sample.id}`), 403, 'documents teacher'),
      );
    }
  }
  return { documents: all };
}

module.exports = { run };
