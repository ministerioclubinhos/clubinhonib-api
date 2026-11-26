const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');

const patch = (http, id, data, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/week-material-pages/${id}`, fields: data === null ? {} : { weekMaterialsPageData: JSON.stringify(data) }, files });

/** `PATCH /week-material-pages/:id`: textos, os quatro grupos de mídia (mantidos por id, removidos, novos), currentWeek ignorado, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('week-material-pages/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const mp4 = uploadMedia('mp4', 'wu_mp4', { title: 'Vídeo' });
  const pdf = uploadMedia('pdf', 'wu_pdf', { title: 'PDF' });
  const png = uploadMedia('png', 'wu_png', { title: 'Imagem' });
  const mp3 = uploadMedia('mp3', 'wu_mp3', { title: 'Áudio' });
  const page = (await multipartRequest({ http, method: 'POST', path: '/week-material-pages', fields: { weekMaterialsPageData: JSON.stringify({ pageTitle: 'Semana para editar', pageSubtitle: 'Sub', pageDescription: 'Desc', videos: [linkMedia({ mediaType: 'video' }), mp4.item], documents: [pdf.item], images: [png.item], audios: [mp3.item] }) }, files: mergeFiles(mp4, pdf, png, mp3) })).data;
  const id = page.id;
  const load = async () => (await http.request('get', `/week-material-pages/${id}`)).data;
  const groups = (p) => ({ videos: (p.videos ?? []).map((m) => toMediaInput(m)), documents: (p.documents ?? []).map((m) => toMediaInput(m)), images: (p.images ?? []).map((m) => toMediaInput(m)), audios: (p.audios ?? []).map((m) => toMediaInput(m)) });

  await logger.check('PATCH edita título, subtítulo e descrição mantendo os quatro grupos por id', async () => {
    const cur = await load();
    const res = await patch(http, id, { id, pageTitle: 'Semana Editada', pageSubtitle: 'Sub editado', pageDescription: 'Desc editada', ...groups(cur) });
    if ((res.data.title ?? res.data.pageTitle) !== 'Semana Editada') throw new Error('título');
    for (const k of ['videos', 'documents', 'images', 'audios']) if (res.data[k].length !== cur[k].length) throw new Error(`${k} ${cur[k].length}->${res.data[k].length}`);
    return 'ok';
  });
  await logger.check('PATCH renomeia uma mídia, remove o link de vídeo, adiciona DOCX e WAV novos', async () => {
    const cur = await load();
    const docx = uploadMedia('docx', 'wu_docx', { title: 'DOCX novo' });
    const wav = uploadMedia('wav', 'wu_wav', { title: 'WAV novo' });
    const g = groups(cur);
    g.videos = cur.videos.filter((v) => v.isLocalFile).map((v) => toMediaInput(v, { title: 'Vídeo renomeado' }));
    g.documents = [...g.documents, docx.item];
    g.audios = [...g.audios, wav.item];
    const res = await patch(http, id, { id, pageTitle: cur.title, pageSubtitle: cur.subtitle, pageDescription: cur.description, ...g }, mergeFiles(docx, wav));
    if (res.data.videos.length !== 1 || res.data.videos[0].title !== 'Vídeo renomeado') throw new Error('vídeos');
    if (res.data.documents.length !== 2 || res.data.audios.length !== 2) throw new Error('docs/audios');
    return `d=${res.data.documents.length} a=${res.data.audios.length}`;
  });
  await logger.check('PATCH com currentWeek=true no corpo não publica a página', async () => {
    const cur = await load();
    const res = await patch(http, id, { id, pageTitle: cur.title, pageSubtitle: cur.subtitle, pageDescription: cur.description, currentWeek: true, ...groups(cur) });
    if (res.data.currentWeek !== cur.currentWeek) throw new Error('currentWeek mudou pelo PATCH');
    return `currentWeek=${res.data.currentWeek}`;
  });
  await logger.check('PATCH esvazia imagens e áudios', async () => {
    const cur = await load();
    const res = await patch(http, id, { id, pageTitle: cur.title, pageSubtitle: cur.subtitle, pageDescription: cur.description, ...groups(cur), images: [], audios: [] });
    if (res.data.images.length !== 0 || res.data.audios.length !== 0) throw new Error('não esvaziou');
    return 'ok';
  });
  await logger.check('PATCH sem pageTitle responde 400/422', () => expectHttpError(() => patch(http, id, { id, pageSubtitle: 'x', pageDescription: 'y' }), [400, 422], 'sem título'));
  await logger.check('PATCH com upload sem arquivo responde 400/422', () => { const up = uploadMedia('pdf', 'faltando'); return expectHttpError(() => patch(http, id, { id, pageTitle: 'x', pageSubtitle: 'y', pageDescription: 'z', documents: [up.item] }), [400, 422], 'sem arquivo'); });
  await logger.check('PATCH com upload sem fieldKey responde 400/422', () => { const { item } = uploadMedia('pdf', 'k'); delete item.fieldKey; return expectHttpError(() => patch(http, id, { id, pageTitle: 'x', pageSubtitle: 'y', pageDescription: 'z', documents: [item] }), [400, 422], 'sem fieldKey'); });
  await logger.check('PATCH sem weekMaterialsPageData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { pageTitle: 'x', pageSubtitle: 'y', pageDescription: 'z' }), 404, '404'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /week-material-pages/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { pageTitle: 'x', pageSubtitle: 'y', pageDescription: 'z' }), 403, role));
  }
  await logger.check('PATCH anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { pageTitle: 'x', pageSubtitle: 'y', pageDescription: 'z' }), 401, 'anônimo'));
  await http.request('delete', `/week-material-pages/${id}`);
  return { ok: true };
}

module.exports = { run };
