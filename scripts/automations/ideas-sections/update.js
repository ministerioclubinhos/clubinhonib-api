const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');
const { buildIdeasPage } = require('../ideas-pages/create');

const patch = (http, id, data, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/ideas-sections/${id}`, fields: data === null ? {} : { sectionData: JSON.stringify(data) }, files });

/** `PATCH /ideas-sections/:id` e `/attach/:pageId`: texto, public, mídias mantidas por id, trocadas e novas, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('ideas-sections/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const pdf = uploadMedia('pdf', 'idea_u_pdf', { title: 'PDF da ideia' });
  const created = (await multipartRequest({ http: as.teacher ?? http, method: 'POST', path: '/ideas-sections', fields: { sectionData: JSON.stringify({ title: 'Ideia para editar', description: 'Desc', medias: [pdf.item, linkMedia({ mediaType: 'video' })] }) }, files: mergeFiles(pdf) })).data;
  const id = created.id;
  const load = async () => (await http.request('get', `/ideas-sections/${id}`)).data;

  await logger.check('PATCH edita título, descrição e public mantendo as mídias por id', async () => {
    const cur = await load();
    const res = await patch(http, id, { title: 'Ideia editada', description: 'Desc editada', public: true, medias: cur.medias.map((m) => toMediaInput(m)) });
    if (res.data.title !== 'Ideia editada' || res.data.public !== true) throw new Error('texto/public');
    if (res.data.medias.length !== cur.medias.length || !res.data.medias.some((m) => m.isLocalFile)) throw new Error('mídias perdidas');
    return `medias=${res.data.medias.length}`;
  });
  await logger.check('PATCH remove o link, adiciona imagem nova e troca o arquivo do PDF', async () => {
    const cur = await load();
    const upload = cur.medias.find((m) => m.isLocalFile);
    const jpg = uploadMedia('jpg', 'idea_u_jpg', { title: 'Foto nova' });
    const replaced = uploadMedia('docx', 'idea_u_docx', { title: 'PDF virou DOCX' });
    const res = await patch(http, id, { title: cur.title, description: cur.description, public: cur.public, medias: [{ ...toMediaInput(upload), ...replaced.item, id: upload.id }, jpg.item] }, mergeFiles(jpg, replaced));
    if (res.data.medias.length !== 2) throw new Error(`medias=${res.data.medias.length}`);
    const swapped = res.data.medias.find((m) => m.id === upload.id);
    if (!swapped || swapped.url === upload.url) throw new Error('arquivo não trocado');
    return 'ok';
  });
  await logger.check('PATCH com medias vazio remove todas as mídias', async () => {
    const cur = await load();
    const res = await patch(http, id, { title: cur.title, description: cur.description, medias: [] });
    if (res.data.medias.length !== 0) throw new Error('não removeu');
    return 'ok';
  });
  await logger.check('PATCH upload novo sem arquivo responde 400/422', async () => { const cur = await load(); const up = uploadMedia('pdf', 'nao_enviado'); return expectHttpError(() => patch(http, id, { title: cur.title, description: cur.description, medias: [up.item] }), [400, 422], 'sem arquivo'); });
  await logger.check('PATCH sem title responde 400/422', () => expectHttpError(() => patch(http, id, { description: 'x', medias: [] }), [400, 422], 'sem title'));
  await logger.check('PATCH com mediaType audio responde 400/422', () => expectHttpError(() => patch(http, id, { title: 'x', description: 'y', medias: [linkMedia({ mediaType: 'audio', platformType: 'ANY' })] }), [400, 422], 'audio'));

  const built = buildIdeasPage(951);
  const page = (await multipartRequest({ http, method: 'POST', path: '/ideas-pages', fields: { ideasMaterialsPageData: JSON.stringify(built.payload) }, files: built.files })).data;
  await logger.check('PATCH attach publica na página com mídia nova e a fila diminui', async () => {
    const before = (await http.request('get', '/ideas-sections/pending-count')).data.pending;
    const cur = await load();
    const res = await multipartRequest({ http, method: 'PATCH', path: `/ideas-sections/${id}/attach/${page.id}`, fields: { sectionData: JSON.stringify({ title: cur.title, description: cur.description, public: true, medias: [linkMedia({ mediaType: 'video' })] }) }, files: {} });
    if (res.data.pageId !== page.id) throw new Error('pageId');
    const after = (await http.request('get', '/ideas-sections/pending-count')).data.pending;
    if (after !== before - 1) throw new Error(`pending ${before}->${after}`);
    const pageAfter = (await http.request('get', `/ideas-pages/${page.id}`)).data;
    if (!pageAfter.sections.some((s) => s.id === id)) throw new Error('não entrou na página');
    return `pending ${before}->${after}`;
  });
  await logger.check('PATCH da ideia já publicada continua permitido e não muda a página', async () => {
    const res = await patch(http, id, { title: 'Publicada e editada', description: 'x', public: true, medias: [] });
    if (res.data.pageId !== page.id || res.data.title !== 'Publicada e editada') throw new Error('edição pós-publicação');
    return 'ok';
  });
  await logger.check('attach repetido responde 400/409', () => expectHttpError(() => multipartRequest({ http, method: 'PATCH', path: `/ideas-sections/${id}/attach/${page.id}`, fields: { sectionData: JSON.stringify({ title: 'x', description: 'y', medias: [] }) }, files: {} }), [400, 409], 'attach repetido'));
  await logger.check('attach em página inexistente responde 404', async () => {
    const other = (await multipartRequest({ http, method: 'POST', path: '/ideas-sections', fields: { sectionData: JSON.stringify({ title: 'Outra', description: 'y', medias: [] }) }, files: {} })).data;
    const r = await expectHttpError(() => multipartRequest({ http, method: 'PATCH', path: `/ideas-sections/${other.id}/attach/${MISSING_ID}`, fields: { sectionData: JSON.stringify({ title: 'x', description: 'y', medias: [] }) }, files: {} }), 404, 'página 404');
    await http.request('delete', `/ideas-sections/${other.id}`);
    return r;
  });
  await logger.check('PATCH sem sectionData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { title: 'x', description: 'y', medias: [] }), 404, '404'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /ideas-sections/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { title: 'x', description: 'y', medias: [] }), 403, role));
  }
  await logger.check('PATCH anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { title: 'x', description: 'y', medias: [] }), 401, 'anônimo'));
  await http.request('delete', `/ideas-pages/${page.id}`);
  return { ok: true };
}

module.exports = { run };
