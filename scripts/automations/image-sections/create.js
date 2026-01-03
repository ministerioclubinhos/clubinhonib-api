const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/image-sections');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[image-sections/create] garantindo mínimo ${min} (atual=${existing.length}, criar=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
  const dto = {
    caption: 'Section (automação)',
    description: 'Criada pela automação',
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
  };

  logger.info('[image-sections/create] criando image-section (multipart)...');
  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/image-sections',
    fields: { sectionData: JSON.stringify(dto) },
    files: {},
  });
    created.push(res.data);
    await sleep(30);
  }

  logger.info(`[image-sections/create] OK created=${created.length}`);
  return { created };
}

module.exports = { run };
