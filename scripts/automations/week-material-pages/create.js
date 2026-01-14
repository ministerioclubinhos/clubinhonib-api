const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/week-material-pages');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[week-material-pages/create] ensuring minimum ${min} (current=${existing.length}, creating=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
  const dto = {
    pageTitle: `Week Materials (automation) #${existing.length + i + 1}`,
    pageSubtitle: 'Automation subtitle',
    pageDescription: 'Created by automation',
    videos: [
      {
        title: 'Video',
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
        title: 'Document',
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
