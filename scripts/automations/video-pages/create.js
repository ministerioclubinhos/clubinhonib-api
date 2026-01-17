const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/video-pages');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[video-pages/create] ensuring minimum ${min} (current=${existing.length}, creating=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
  const dto = {
    title: `Página de Vídeos (automação) #${existing.length + i + 1}`,
    description: 'Created by automation',
    public: true,
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
  };

  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/video-pages',
    fields: { videosPageData: JSON.stringify(dto) },
    files: {},
  });
    created.push(res.data);
    await sleep(30);
  }

  logger.info(`[video-pages/create] OK created=${created.length}`);
  return { created };
}

module.exports = { run };
