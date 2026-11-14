const { multipartRequest } = require('../common/multipart');
const { uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');

const patch = (http, id, data, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/image-sections/${id}`, fields: data === null ? {} : { sectionData: JSON.stringify(data) }, files });

/** `PATCH /image-sections/:id`: revisão e aprovação (public), legenda/descrição, fotos mantidas/removidas/novas, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('image-sections/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const a = uploadMedia('jpg', 'isu_a', { title: 'Foto A' });
  const b = uploadMedia('png', 'isu_b', { title: 'Foto B', seed: 3 });
  const created = (await multipartRequest({ http: as.teacher ?? http, method: 'POST', path: '/image-sections', fields: { sectionData: JSON.stringify({ caption: 'Fotos para revisar', description: 'Desc', mediaItems: [a.item, b.item] }) }, files: mergeFiles(a, b) })).data;
  const id = created.id;
  const load = async () => (await http.request('get', `/image-sections/${id}`)).data;
  const items = (s) => s.mediaItems ?? s.images ?? [];

  await logger.check('PATCH salva sem publicar (public=false) editando legenda e descrição', async () => {
    const cur = await load();
    const res = await patch(http, id, { caption: 'Legenda revisada', description: 'Descrição revisada', public: false, mediaItems: items(cur).map((m) => toMediaInput(m)) });
    if (res.data.caption !== 'Legenda revisada' || res.data.public !== false) throw new Error('legenda/public');
    if (items(res.data).length !== 2) throw new Error('fotos perdidas');
    return 'ok';
  });
  await logger.check('PATCH aprova (public=true) removendo uma foto e adicionando outra', async () => {
    const cur = await load();
    const up = uploadMedia('png', 'isu_c', { title: 'Foto C', seed: 5 });
    const res = await patch(http, id, { caption: cur.caption, description: cur.description, public: true, mediaItems: [toMediaInput(items(cur)[0]), up.item] }, mergeFiles(up));
    if (res.data.public !== true || items(res.data).length !== 2) throw new Error('aprovação');
    if (items(res.data).some((m) => m.id === items(cur)[1].id)) throw new Error('foto removida ainda presente');
    const approved = (await http.request('get', '/image-sections', { params: { approved: true, page: 1, limit: 100 } })).data;
    const pending = (await http.request('get', '/image-sections', { params: { approved: false, page: 1, limit: 100 } })).data;
    return `pageId=${res.data.pageId ?? 'null'} approvedTotal=${approved.total} pendingTotal=${pending.total}`;
  });
  await logger.check('PATCH com public omitido volta a false (default do contrato)', async () => {
    const cur = await load();
    const res = await patch(http, id, { caption: cur.caption, description: cur.description, mediaItems: items(cur).map((m) => toMediaInput(m)) });
    if (res.data.public !== false) throw new Error(`public=${res.data.public}`);
    return 'ok';
  });
  await logger.check('PATCH upload novo sem arquivo responde 400/422', async () => { const cur = await load(); const up = uploadMedia('png', 'isu_x'); return expectHttpError(() => patch(http, id, { caption: cur.caption, description: cur.description, mediaItems: [up.item] }), [400, 422], 'sem arquivo'); });
  await logger.check('PATCH sem caption responde 400/422', () => expectHttpError(() => patch(http, id, { description: 'x', mediaItems: [] }), [400, 422], 'sem caption'));
  await logger.check('PATCH sem sectionData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { caption: 'x', description: 'y', mediaItems: [] }), 404, '404'));
  await logger.check('PATCH com uuid inválido responde 400/422', () => expectHttpError(() => patch(http, 'x', { caption: 'x', description: 'y', mediaItems: [] }), [400, 422], 'uuid'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /image-sections/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { caption: 'x', description: 'y', mediaItems: [] }), 403, role));
  }
  await logger.check('PATCH anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { caption: 'x', description: 'y', mediaItems: [] }), 401, 'anônimo'));
  await http.request('delete', `/image-sections/${id}`);
  return { ok: true };
}

module.exports = { run };
