const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/image-pages');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[image-pages/create] garantindo mínimo ${min} (atual=${existing.length}, criar=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
  const dto = {
    title: `Galeria (automação) #${existing.length + i + 1}`,
    description: 'Criada pela automação',
    public: true,
    sections: [
      {
        caption: 'Seção 1',
        description: 'Descrição seção',
        public: true,
        mediaItems: [
          {
            title: 'Imagem',
            description: 'link',
            uploadType: 'link',
            mediaType: 'image',
            isLocalFile: false,
            url: 'https://example.com/img.jpg',
            platformType: 'ANY',
          },
        ],
      },
    ],
  };

  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/image-pages',
    fields: { imageData: JSON.stringify(dto) },
    files: {},
  });
    created.push(res.data);
    await sleep(30);
  }

  logger.info(`[image-pages/create] OK created=${created.length}`);
  return { created };
}

module.exports = { run };
