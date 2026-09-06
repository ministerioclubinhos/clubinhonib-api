const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/**
 * Documentos com arquivo real (PDF, DOCX, TXT, CSV) e por link. O JSON vai no
 * campo `documentData`; o arquivo, no campo que `media.fileField` nomeia.
 */
async function createDocument({ http, kind, index }) {
  const file = fixture(kind, { seed: index, title: `Documento ${kind.toUpperCase()} #${index}` });
  const documentData = {
    name: `Documento ${kind.toUpperCase()} da automação #${index}`,
    description: `Arquivo ${file.filename} enviado pelos scripts`,
    media: { title: file.filename, description: 'Upload real', uploadType: 'upload', mediaType: 'document', isLocalFile: true, fileField: 'docFile' },
  };
  const res = await multipartRequest({ http, method: 'POST', path: '/documents', fields: { documentData: JSON.stringify(documentData) }, files: { docFile: file } });
  return res.data;
}

async function run({ http, logger, ctx }) {
  logger.section('documents/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdDocuments = [];

  const kinds = ['pdf', 'docx', 'txt', 'csv', 'pdf'];
  const existing = await http.request('get', '/documents', { params: { page: 1, limit: 1 } });
  const toCreate = Math.max(kinds.length, min - (existing.data.total ?? 0));
  for (let i = 0; i < toCreate; i++) {
    const kind = kinds[i % kinds.length];
    await logger.check(`POST /documents upload ${kind}`, async () => {
      const doc = await createDocument({ http, kind, index: i + 1 });
      if (!doc.media?.url?.startsWith('http') || doc.media.isLocalFile !== true) throw new Error('mídia sem url de upload');
      ctx.createdDocuments.push(doc);
      return `id=${doc.id} url=${doc.media.url.split('/').pop()}`;
    });
  }

  await logger.check('POST /documents por link (Google Drive)', async () => {
    const documentData = {
      name: 'Documento por link da automação',
      description: 'Sem arquivo; aponta para o Drive',
      media: { title: 'Planilha no Drive', description: 'link', uploadType: 'link', mediaType: 'document', isLocalFile: false, url: 'https://drive.google.com/file/d/automation-doc/view', platformType: 'googledrive' },
    };
    const res = await multipartRequest({ http, method: 'POST', path: '/documents', fields: { documentData: JSON.stringify(documentData) }, files: {} });
    if (res.data.media?.isLocalFile !== false) throw new Error('link marcado como local');
    ctx.createdDocuments.push(res.data);
    return `id=${res.data.id}`;
  });

  await logger.check('POST /documents sem documentData responde 400/422', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/documents', fields: {}, files: { docFile: fixture('txt') } }), [400, 422], 'documents sem payload'),
  );
  await logger.check('POST /documents upload sem o arquivo responde 4xx/5xx controlado', () =>
    expectHttpError(
      () => multipartRequest({ http, method: 'POST', path: '/documents', fields: { documentData: JSON.stringify({ name: 'x', media: { uploadType: 'upload', mediaType: 'document', isLocalFile: true, fileField: 'docFile' } }) }, files: {} }),
      [400, 422, 500],
      'documents sem arquivo',
    ),
  );
  if (as.coordinator) {
    await logger.check('POST /documents como coordenador responde 403', () =>
      expectHttpError(() => multipartRequest({ http: as.coordinator, method: 'POST', path: '/documents', fields: { documentData: '{}' }, files: {} }), 403, 'documents coord'),
    );
  }
  return { created: ctx.createdDocuments };
}

module.exports = { run, createDocument };
