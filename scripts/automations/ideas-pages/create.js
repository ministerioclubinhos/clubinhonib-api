const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/ideas-pages');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[ideas-pages/create] ensuring minimum ${min} (current=${existing.length}, creating=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
  const dto = {
    title: `Página de Ideias (automação) #${existing.length + i + 1}`,
    subtitle: 'Subtítulo',
    description: 'Created by automation',
    public: true,
    sections: [
      {
        title: 'Seção 1',
        description: 'Conteúdo da seção',
        public: true,
        medias: [
          {
            title: 'Vídeo',
            description: 'link',
            mediaType: 'video',
            uploadType: 'link',
            isLocalFile: false,
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            platformType: 'youtube',
            size: '0',
          },
        ],
      },
    ],
  };

  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/ideas-pages',
    fields: { ideasMaterialsPageData: JSON.stringify(dto) },
    files: {},
  });
    created.push(res.data);
    await sleep(30);
  }

  logger.info(`[ideas-pages/create] OK created=${created.length}`);
  return { created };
}

module.exports = { run };
