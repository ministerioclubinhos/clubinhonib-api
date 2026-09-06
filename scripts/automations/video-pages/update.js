const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');

const patch = (http, id, data, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/video-pages/${id}`, fields: data === null ? {} : { videosPageData: JSON.stringify(data) }, files });

/** `PATCH /video-pages/:id`: texto/public, vídeos mantidos por id (título editado), removidos, link novo, MP4 novo, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('video-pages/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const mp4 = uploadMedia('mp4', 'vu_mp4', { title: 'Vídeo gravado' });
  const page = (await multipartRequest({ http, method: 'POST', path: '/video-pages', fields: { videosPageData: JSON.stringify({ title: 'Vídeos para editar', description: 'Desc', public: true, videos: [linkMedia({ mediaType: 'video' }), mp4.item] }) }, files: mergeFiles(mp4) })).data;
  const id = page.id;
  const load = async () => (await http.request('get', `/video-pages/${id}`)).data;

  await logger.check('PATCH edita título, descrição e public mantendo vídeos por id e renomeando um', async () => {
    const cur = await load();
    const videos = cur.videos.map((v, i) => toMediaInput(v, i === 0 ? { title: 'Título renomeado' } : {}));
    const res = await patch(http, id, { id, title: 'Vídeos Editados', description: 'Desc editada', public: false, videos });
    if (res.data.title !== 'Vídeos Editados' || res.data.public !== false) throw new Error('texto/public');
    if (res.data.videos.length !== cur.videos.length || !res.data.videos.some((v) => v.title === 'Título renomeado')) throw new Error('vídeos');
    if (!res.data.videos.some((v) => v.isLocalFile && v.url === cur.videos.find((c) => c.isLocalFile).url)) throw new Error('upload perdido');
    return `videos=${res.data.videos.length}`;
  });
  await logger.check('PATCH remove o link, adiciona um link novo e um MP4 novo', async () => {
    const cur = await load();
    const kept = cur.videos.filter((v) => v.isLocalFile).map((v) => toMediaInput(v));
    const up = uploadMedia('mp4', 'vu_mp4_2', { title: 'Segundo vídeo' });
    const res = await patch(http, id, { id, title: cur.title, description: cur.description, public: cur.public, videos: [...kept, linkMedia({ mediaType: 'video', url: 'https://youtu.be/kJQP7kiw5Fk' }), up.item] }, mergeFiles(up));
    if (res.data.videos.length !== kept.length + 2 || res.data.videos.filter((v) => v.isLocalFile).length !== 2) throw new Error(`videos=${res.data.videos.length}`);
    return `videos=${res.data.videos.length}`;
  });
  await logger.check('PATCH com videos vazio esvazia a página', async () => {
    const cur = await load();
    const res = await patch(http, id, { id, title: cur.title, description: cur.description, public: cur.public, videos: [] });
    if (res.data.videos.length !== 0) throw new Error('não esvaziou');
    return 'ok';
  });
  await logger.check('PATCH sem id no corpo responde 400/422', () => expectHttpError(() => patch(http, id, { title: 'x', description: 'y', public: true, videos: [] }), [400, 422], 'sem id'));
  await logger.check('PATCH com platformType inválido responde 400/422', () => expectHttpError(() => patch(http, id, { id, title: 'x', description: 'y', public: true, videos: [linkMedia({ platformType: 'vimeo' })] }), [400, 422], 'platform'));
  await logger.check('PATCH com upload sem arquivo responde 4xx', () => { const up = uploadMedia('mp4', 'faltando'); return expectHttpError(() => patch(http, id, { id, title: 'x', description: 'y', public: true, videos: [up.item] }), [400, 422, 500], 'sem arquivo'); });
  await logger.check('PATCH sem videosPageData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { id: MISSING_ID, title: 'x', description: 'y', public: true, videos: [] }), 404, '404'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /video-pages/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { id, title: 'x', description: 'y', public: true, videos: [] }), 403, role));
  }
  await logger.check('PATCH anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { id, title: 'x', description: 'y', public: true, videos: [] }), 401, 'anônimo'));
  await http.request('delete', `/video-pages/${id}`);
  return { ok: true };
}

module.exports = { run };
