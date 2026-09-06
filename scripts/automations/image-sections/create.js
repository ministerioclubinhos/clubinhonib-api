const { multipartRequest } = require('../common/multipart');
const { uploadMedia, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Fotos enviadas pelo clubinho (professor/coordenador): entram na fila fora do ar. */
function buildImageSection(index) {
  const a = uploadMedia('jpg', `photo_${index}_a`, { title: 'Foto do encontro', seed: index });
  const b = uploadMedia('png', `photo_${index}_b`, { title: 'Foto das crianças', seed: index + 5 });
  return {
    payload: { caption: `Encontro do clubinho #${index}`, description: 'Fotos enviadas pela automação', mediaItems: [a.item, b.item] },
    files: mergeFiles(a, b),
  };
}

async function run({ http, logger, ctx }) {
  logger.section('image-sections/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  ctx.createdImageSections = [];

  let i = 0;
  for (const [key, client] of Object.entries({ teacher: as.teacher, coordinator: as.coordinator, superuser: http })) {
    if (!client) continue;
    i += 1;
    await logger.check(`POST /image-sections como ${key} (jpg + png)`, async () => {
      const { payload, files } = buildImageSection(i);
      const res = await multipartRequest({ http: client, method: 'POST', path: '/image-sections', fields: { sectionData: JSON.stringify(payload) }, files });
      if (res.data.public !== false) throw new Error('fotos novas deveriam nascer fora do ar');
      const items = res.data.mediaItems ?? res.data.images ?? [];
      if (items.length !== 2) throw new Error(`esperava 2 fotos, veio ${items.length}`);
      ctx.createdImageSections.push(res.data);
      return `id=${res.data.id}`;
    });
  }

  await logger.check('POST /image-sections upload sem arquivo responde 400/422', async () => {
    const { payload } = buildImageSection(99);
    return expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/image-sections', fields: { sectionData: JSON.stringify(payload) }, files: {} }), [400, 422], 'photos sem arquivo');
  });
  await logger.check('POST /image-sections com public no corpo responde 400/422 (whitelist)', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/image-sections', fields: { sectionData: JSON.stringify({ caption: 'x', description: 'y', public: true, mediaItems: [] }) }, files: {} }), [400, 422], 'photos whitelist'),
  );
  await logger.check('POST /image-sections anônimo responde 401', () =>
    expectHttpError(() => multipartRequest({ http: as.anonymous, method: 'POST', path: '/image-sections', fields: { sectionData: '{}' }, files: {} }), 401, 'photos anônimo'),
  );
  return { created: ctx.createdImageSections };
}

module.exports = { run };
