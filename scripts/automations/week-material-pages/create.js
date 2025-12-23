const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/week-material-pages');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[week-material-pages/create] garantindo mínimo ${min} (atual=${existing.length}, criar=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
  const dto = {
    pageTitle: `Materiais da Semana (automação) #${existing.length + i + 1}`,
    pageSubtitle: 'Subtítulo automação',
    pageDescription: 'Criado pela automação',
    videos: [
      {
        title: 'Vídeo',
        description: 'link',
        uploadType: 'link',
        mediaType: 'video',
        isLocalFile: false,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        platformType: 'youtube',
      },
    ],
    documents: [
      {
        title: 'Documento',
        description: 'link',
        uploadType: 'link',
        mediaType: 'document',
        isLocalFile: false,
        url: 'https://example.com/doc.pdf',
        platformType: 'ANY',
      },
    ],
  };

  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/week-material-pages',
    fields: { weekMaterialsPageData: JSON.stringify(dto) },
    files: {},
  });
    created.push(res.data);
    await sleep(30);
  }

  logger.info(`[week-material-pages/create] OK created=${created.length}`);
  return { created };
}

module.exports = { run };
