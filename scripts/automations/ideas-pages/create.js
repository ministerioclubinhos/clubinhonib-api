const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/**
 * Página de ideias com seções e mídias mistas: vídeo por link (YouTube),
 * documento (PDF) e imagem (PNG) enviados de verdade, cada um no campo
 * multipart declarado em `fieldKey`.
 */
function buildIdeasPage(index) {
  const pdf = uploadMedia('pdf', `ideas_doc_${index}`, { title: 'Roteiro da atividade', seed: index });
  const png = uploadMedia('png', `ideas_img_${index}`, { title: 'Foto da dinâmica', seed: index });
  const payload = {
    title: `Página de Ideias da automação #${index}`,
    subtitle: 'Dinâmicas e recursos',
    description: 'Criada pelos scripts de automação',
    public: index % 2 === 0,
    sections: [
      { title: 'Vídeos', description: 'Ideias em vídeo', public: true, medias: [linkMedia({ mediaType: 'video' }), linkMedia({ mediaType: 'video', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0' })] },
      { title: 'Documentos e fotos', description: 'Material de apoio', public: true, medias: [pdf.item, png.item] },
      { title: 'Seção interna', description: 'Só para a equipe', public: false, medias: [linkMedia({ mediaType: 'document', url: 'https://drive.google.com/file/d/ideas/view', platformType: 'googledrive', title: 'Guia no Drive' })] },
    ],
  };
  return { payload, files: mergeFiles(pdf, png) };
}

async function run({ http, logger, ctx }) {
  logger.section('ideas-pages/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdIdeasPages = [];

  const existing = await http.request('get', '/ideas-pages', { params: { page: 1, limit: 1 } });
  const toCreate = Math.max(2, min - (existing.data.total ?? 0));
  for (let i = 0; i < toCreate; i++) {
    await logger.check(`POST /ideas-pages #${i + 1} (link + pdf + png)`, async () => {
      const { payload, files } = buildIdeasPage((existing.data.total ?? 0) + i + 1);
      const res = await multipartRequest({ http, method: 'POST', path: '/ideas-pages', fields: { ideasMaterialsPageData: JSON.stringify(payload) }, files });
      const medias = (res.data.sections ?? []).flatMap((s) => s.medias ?? []);
      if ((res.data.sections?.length ?? 0) !== 3) throw new Error(`esperava 3 seções, veio ${res.data.sections?.length}`);
      if (!medias.some((m) => m.isLocalFile && m.url?.includes('amazonaws'))) throw new Error('nenhuma mídia subiu para o S3');
      ctx.createdIdeasPages.push(res.data);
      return `id=${res.data.id} medias=${medias.length}`;
    });
  }

  await logger.check('POST /ideas-pages sem sections responde 400/422', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/ideas-pages', fields: { ideasMaterialsPageData: JSON.stringify({ title: 'x', description: 'y' }) }, files: {} }), [400, 422], 'ideas sem sections'),
  );
  await logger.check('POST /ideas-pages com upload sem arquivo responde 4xx/5xx controlado', async () => {
    const { payload } = buildIdeasPage(999);
    return expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/ideas-pages', fields: { ideasMaterialsPageData: JSON.stringify(payload) }, files: {} }), [400, 422, 500], 'ideas sem arquivo');
  });
  if (as.teacher) {
    await logger.check('POST /ideas-pages como professor responde 403', () =>
      expectHttpError(() => multipartRequest({ http: as.teacher, method: 'POST', path: '/ideas-pages', fields: { ideasMaterialsPageData: '{}' }, files: {} }), 403, 'ideas teacher'),
    );
  }
  return { created: ctx.createdIdeasPages };
}

module.exports = { run, buildIdeasPage };
