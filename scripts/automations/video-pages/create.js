const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Página de vídeos: links do YouTube e um MP4 real enviado no campo `fieldKey`. */
function buildVideosPage(index) {
  const mp4 = uploadMedia('mp4', `video_${index}`, { title: 'Vídeo gravado no clubinho', seed: index });
  return {
    payload: {
      title: `Página de Vídeos da automação #${index}`,
      description: 'Vídeos do ministério',
      public: index % 2 === 1,
      videos: [linkMedia({ mediaType: 'video' }), linkMedia({ mediaType: 'video', url: 'https://youtu.be/kJQP7kiw5Fk', title: 'Louvor' }), mp4.item],
    },
    files: mergeFiles(mp4),
  };
}

async function run({ http, logger, ctx }) {
  logger.section('video-pages/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdVideoPages = [];

  const existing = await http.request('get', '/video-pages', { params: { page: 1, limit: 1 } });
  const toCreate = Math.max(2, min - (existing.data.total ?? 0));
  for (let i = 0; i < toCreate; i++) {
    await logger.check(`POST /video-pages #${i + 1} (2 links + mp4)`, async () => {
      const { payload, files } = buildVideosPage((existing.data.total ?? 0) + i + 1);
      const res = await multipartRequest({ http, method: 'POST', path: '/video-pages', fields: { videosPageData: JSON.stringify(payload) }, files });
      const videos = res.data.videos ?? [];
      if (videos.length !== 3) throw new Error(`esperava 3 vídeos, veio ${videos.length}`);
      if (!videos.some((v) => v.isLocalFile && v.url?.includes('amazonaws'))) throw new Error('mp4 não subiu para o S3');
      ctx.createdVideoPages.push(res.data);
      return `id=${res.data.id}`;
    });
  }

  await logger.check('POST /video-pages com videos fora de array responde 400/422', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/video-pages', fields: { videosPageData: JSON.stringify({ title: 'x', description: 'y', public: true, videos: 'nope' }) }, files: {} }), [400, 422], 'videos array'),
  );
  await logger.check('POST /video-pages com platformType inválido responde 400/422', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/video-pages', fields: { videosPageData: JSON.stringify({ title: 'x', description: 'y', public: true, videos: [linkMedia({ platformType: 'vimeo' })] }) }, files: {} }), [400, 422], 'videos platform'),
  );
  if (as.coordinator) {
    await logger.check('POST /video-pages como coordenador responde 403', () =>
      expectHttpError(() => multipartRequest({ http: as.coordinator, method: 'POST', path: '/video-pages', fields: { videosPageData: '{}' }, files: {} }), 403, 'videos coord'),
    );
  }
  return { created: ctx.createdVideoPages };
}

module.exports = { run };
