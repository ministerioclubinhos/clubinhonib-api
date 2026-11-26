const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Materiais da semana com os quatro grupos: vídeos (link + mp4), documentos (pdf, docx), imagens (png) e áudios (mp3). */
function buildWeekMaterials(index) {
  const mp4 = uploadMedia('mp4', `wm_video_${index}`, { title: 'Vídeo da lição', seed: index });
  const pdf = uploadMedia('pdf', `wm_pdf_${index}`, { title: 'Lição em PDF', seed: index });
  const docx = uploadMedia('docx', `wm_docx_${index}`, { title: 'Roteiro em DOCX', seed: index });
  const png = uploadMedia('png', `wm_img_${index}`, { title: 'Ilustração', seed: index });
  const mp3 = uploadMedia('mp3', `wm_audio_${index}`, { title: 'Música da semana', seed: index });
  return {
    payload: {
      pageTitle: `Materiais da semana #${index} (automação)`,
      pageSubtitle: 'Lição, vídeo, música e ilustração',
      pageDescription: 'Criado pelos scripts de automação',
      videos: [linkMedia({ mediaType: 'video' }), mp4.item],
      documents: [pdf.item, docx.item],
      images: [png.item],
      audios: [mp3.item],
    },
    files: mergeFiles(mp4, pdf, docx, png, mp3),
  };
}

async function run({ http, logger, ctx }) {
  logger.section('week-material-pages/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdWeekMaterials = [];

  const existing = await http.request('get', '/week-material-pages', { params: { page: 1, limit: 1 } });
  const toCreate = Math.max(2, min - (existing.data.total ?? 0));
  for (let i = 0; i < toCreate; i++) {
    await logger.check(`POST /week-material-pages #${i + 1} (mp4, pdf, docx, png, mp3)`, async () => {
      const { payload, files } = buildWeekMaterials((existing.data.total ?? 0) + i + 1);
      const res = await multipartRequest({ http, method: 'POST', path: '/week-material-pages', fields: { weekMaterialsPageData: JSON.stringify(payload) }, files });
      const counts = { videos: res.data.videos?.length ?? 0, documents: res.data.documents?.length ?? 0, images: res.data.images?.length ?? 0, audios: res.data.audios?.length ?? 0 };
      if (counts.videos !== 2 || counts.documents !== 2 || counts.images !== 1 || counts.audios !== 1) throw new Error(`contagem inesperada ${JSON.stringify(counts)}`);
      if (res.data.currentWeek !== false) throw new Error('página nova não deveria ser a da semana');
      ctx.createdWeekMaterials.push(res.data);
      return `id=${res.data.id} ${JSON.stringify(counts)}`;
    });
  }

  await logger.check('POST /week-material-pages sem pageSubtitle responde 400/422', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/week-material-pages', fields: { weekMaterialsPageData: JSON.stringify({ pageTitle: 'x', pageDescription: 'y' }) }, files: {} }), [400, 422], 'wm sem subtitle'),
  );
  await logger.check('POST /week-material-pages upload sem arquivo responde 400/422', async () => {
    const { payload } = buildWeekMaterials(999);
    return expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/week-material-pages', fields: { weekMaterialsPageData: JSON.stringify(payload) }, files: {} }), [400, 422], 'wm sem arquivo');
  });
  if (as.teacher) {
    await logger.check('POST /week-material-pages como professor responde 403', () =>
      expectHttpError(() => multipartRequest({ http: as.teacher, method: 'POST', path: '/week-material-pages', fields: { weekMaterialsPageData: '{}' }, files: {} }), 403, 'wm teacher'),
    );
  }
  return { created: ctx.createdWeekMaterials };
}

module.exports = { run };
