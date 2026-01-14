const { multipartRequest } = require('../common/multipart');

async function run({ http, logger }) {
  const docData = {
    name: 'Documento Automação',
    description: 'Created by automation',
    media: {
      title: 'Arquivo',
      description: 'dummy',
      uploadType: 'upload',
      mediaType: 'document',
      isLocalFile: true,
      fileField: 'docFile',
    },
  };

  logger.info('[documents/create] creating document (multipart)...');
  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/documents',
    fields: { documentData: JSON.stringify(docData) },
    files: {
      docFile: {
        filename: 'documento.txt',
        contentType: 'text/plain',
        content: 'Documento dummy da automação',
      },
    },
  });
  logger.info(`[documents/create] OK status=${res.status} id=${res.data?.id ?? 'n/a'}`);
  return { document: res.data };
}

module.exports = { run };
