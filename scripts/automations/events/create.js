const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

function isoDatePlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/events');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[events/create] garantindo mínimo ${min} (atual=${existing.length}, criar=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
  const eventData = {
    title: `Evento Automação #${existing.length + i + 1}`,
    date: isoDatePlus(7 + i),
    location: 'Local Teste',
    description: 'Criado pela automação',
    media: {
      title: 'Capa',
      description: 'dummy',
      uploadType: 'upload',
      mediaType: 'image',
      isLocalFile: true,
    },
  };

  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/events',
    fields: { eventData: JSON.stringify(eventData) },
    files: {
      file: {
        filename: 'capa-evento.txt',
        contentType: 'text/plain',
        content: 'arquivo dummy evento',
      },
    },
  });
    created.push(res.data);
    await sleep(40);
  }

  logger.info(`[events/create] OK created=${created.length}`);
  return { created };
}

module.exports = { run };
