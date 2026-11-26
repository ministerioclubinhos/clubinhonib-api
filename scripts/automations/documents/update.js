const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');
const { createDocument } = require('./create');

const patch = (http, id, documentData, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/documents/${id}`, fields: documentData === null ? {} : { documentData: JSON.stringify(documentData) }, files });

/** `PATCH /documents/:id`: texto, troca upload→link, link→upload, arquivo novo, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('documents/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const doc = await createDocument({ http, kind: 'pdf', index: 900 });
  const id = doc.id;
  const currentMedia = async () => (await http.request('get', `/documents/${id}`)).data.media;
  const keep = (m) => ({ id: m.id, title: m.title, description: m.description, uploadType: m.uploadType, mediaType: 'document', isLocalFile: m.isLocalFile, url: m.url, platformType: m.platformType ?? undefined, fileField: 'docFile' });

  await logger.check('PATCH edita nome e descrição mantendo o arquivo (media por id/url)', async () => {
    const m = await currentMedia();
    const res = await patch(http, id, { id, name: 'Documento Editado', description: 'Descrição editada', media: keep(m) });
    if (res.data.name !== 'Documento Editado' || res.data.media?.url !== m.url) throw new Error('nome/arquivo divergentes');
    return res.data.media.url.split('/').pop();
  });
  await logger.check('PATCH troca o arquivo por outro (DOCX) e a URL muda', async () => {
    const before = await currentMedia();
    const res = await patch(http, id, { id, name: 'Documento Editado', media: { title: 'Nova versão', description: 'docx', uploadType: 'upload', mediaType: 'document', isLocalFile: true, fileField: 'docFile' } }, { docFile: fixture('docx', { title: 'Nova versão' }) });
    if (res.data.media?.url === before.url || !res.data.media?.originalName?.endsWith('.docx')) throw new Error('arquivo não trocado');
    return res.data.media.originalName;
  });
  await logger.check('PATCH troca upload por link (Drive)', async () => {
    const res = await patch(http, id, { id, name: 'Documento Editado', media: { title: 'Agora é link', description: 'drive', uploadType: 'link', mediaType: 'document', isLocalFile: false, url: 'https://drive.google.com/file/d/edit/view', platformType: 'googledrive' } });
    if (res.data.media?.isLocalFile !== false || res.data.media?.platformType !== 'googledrive') throw new Error('link não aplicado');
    return res.data.media.url;
  });
  await logger.check('PATCH troca link por upload (PDF)', async () => {
    const res = await patch(http, id, { id, name: 'Documento Editado', media: { title: 'Volta ao arquivo', description: 'pdf', uploadType: 'upload', mediaType: 'document', isLocalFile: true, fileField: 'docFile' } }, { docFile: fixture('pdf') });
    if (res.data.media?.isLocalFile !== true) throw new Error('upload não aplicado');
    return res.data.media.originalName;
  });
  await logger.check('PATCH sem documentData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH sem name responde 400/422', () => expectHttpError(() => patch(http, id, { id, media: { uploadType: 'link', mediaType: 'document', isLocalFile: false, url: 'x' } }), [400, 422], 'sem name'));
  await logger.check('PATCH com mediaType inválido responde 400/422', () => expectHttpError(() => patch(http, id, { id, name: 'x', media: { uploadType: 'link', mediaType: 'foto', isLocalFile: false, url: 'x' } }), [400, 422], 'mediaType'));
  await logger.check('PATCH upload declarado sem arquivo e sem mídia anterior local responde 4xx', async () => {
    const m = await currentMedia();
    await patch(http, id, { id, name: 'Documento Editado', media: { title: 'link', uploadType: 'link', mediaType: 'document', isLocalFile: false, url: 'https://example.com/x.pdf', platformType: 'ANY' } });
    const result = await expectHttpError(() => patch(http, id, { id, name: 'x', media: { title: 'sem arquivo', uploadType: 'upload', mediaType: 'document', isLocalFile: true, fileField: 'docFile' } }), [400, 422, 500], 'upload sem arquivo');
    await patch(http, id, { id, name: 'Documento Editado', media: { ...keep(m), id: undefined, uploadType: 'upload', isLocalFile: true } }, { docFile: fixture('pdf') });
    return result;
  });
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { id: MISSING_ID, name: 'x', media: { uploadType: 'link', mediaType: 'document', isLocalFile: false, url: 'x' } }), 404, '404'));
  await logger.check('PATCH com uuid inválido responde 400/422', () => expectHttpError(() => patch(http, 'x', { id: 'x', name: 'x', media: { uploadType: 'link', mediaType: 'document', isLocalFile: false, url: 'x' } }), [400, 422], 'uuid'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /documents/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { id, name: 'x', media: { uploadType: 'link', mediaType: 'document', isLocalFile: false, url: 'x' } }), 403, role));
  }
  await logger.check('PATCH /documents/:id anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { id, name: 'x', media: { uploadType: 'link', mediaType: 'document', isLocalFile: false, url: 'x' } }), 401, 'anônimo'));
  await http.request('delete', `/documents/${id}`);
  return { ok: true };
}

module.exports = { run };
