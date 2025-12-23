const { multipartRequest } = require('../common/multipart');

async function run({ http, logger }) {
  logger.info('[documents/list-fix] listando documentos...');
  const res = await http.request('get', '/documents');
  const docs = Array.isArray(res.data) ? res.data : [];
  logger.info(`[documents/list-fix] OK total=${docs.length}`);

  // Smoke: buscar um documento e tentar update simples (sem arquivo) se suportar
  if (docs[0]?.id) {
    const id = docs[0].id;
    await http.request('get', `/documents/${id}`);
    logger.info('[documents/list-fix] OK /documents/:id');

    // update via multipart (sem arquivo) — mantém media e muda description se existir
    try {
      const current = docs[0];
      const updateData = {
        id,
        name: current.name || 'Documento Automação',
        description: (current.description || '') + ' (verificado)',
        media: current.media || {
          title: 'Arquivo',
          description: 'dummy',
          uploadType: 'link',
          mediaType: 'document',
          isLocalFile: false,
          url: 'https://example.com/doc.pdf',
        },
      };
      await multipartRequest({
        http,
        method: 'PATCH',
        path: `/documents/${id}`,
        fields: { documentData: JSON.stringify(updateData) },
        files: {},
      });
      logger.info(`[documents/list-fix] updated description id=${id}`);
    } catch (e) {
      logger.warn(`[documents/list-fix] update skip/fail id=${id}: ${e.data?.message || e.message}`);
    }
  }

  return { documents: docs };
}

module.exports = { run };
