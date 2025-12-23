const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/ideas-sections');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[ideas-sections/create] garantindo mínimo ${min} (atual=${existing.length}, criar=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
  const dto = {
    title: `Seção de Ideias (automação) #${existing.length + i + 1}`,
    description: 'Criada pela automação',
    public: true,
    medias: [
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

  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/ideas-sections',
    fields: { sectionData: JSON.stringify(dto) },
    files: {},
  });
    created.push(res.data);
    await sleep(30);
  }

  logger.info(`[ideas-sections/create] OK created=${created.length}`);
  return { created };
}

module.exports = { run };
