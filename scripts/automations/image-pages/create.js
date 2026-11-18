const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Galeria com seções; cada seção com fotos reais (PNG/JPG) e uma por link. */
function buildImagePage(index) {
  const a = uploadMedia('png', `gal_${index}_a`, { title: 'Foto 1', seed: index });
  const b = uploadMedia('jpg', `gal_${index}_b`, { title: 'Foto 2', seed: index + 1 });
  const c = uploadMedia('png', `gal_${index}_c`, { title: 'Foto 3', seed: index + 2 });
  return {
    payload: {
      title: `Galeria da automação #${index}`,
      description: 'Fotos do encontro',
      public: index % 2 === 1,
      sections: [
        { caption: 'Abertura', description: 'Chegada das crianças', public: true, mediaItems: [a.item, linkMedia({ mediaType: 'image', url: 'https://picsum.photos/seed/abertura/400', platformType: 'ANY', title: 'Foto externa' })] },
        { caption: 'Atividades', description: 'Dinâmicas', public: true, mediaItems: [b.item, c.item] },
        { caption: 'Bastidores', description: 'Só equipe', public: false, mediaItems: [linkMedia({ mediaType: 'image', url: 'https://picsum.photos/seed/bastidores/400', platformType: 'ANY' })] },
      ],
    },
    files: mergeFiles(a, b, c),
  };
}

async function run({ http, logger, ctx }) {
  logger.section('image-pages/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdImagePages = [];

  const existing = await http.request('get', '/image-pages', { params: { page: 1, limit: 1 } });
  const toCreate = Math.max(2, min - (existing.data.total ?? 0));
  for (let i = 0; i < toCreate; i++) {
    await logger.check(`POST /image-pages #${i + 1} (3 uploads + links)`, async () => {
      const { payload, files } = buildImagePage((existing.data.total ?? 0) + i + 1);
      const res = await multipartRequest({ http, method: 'POST', path: '/image-pages', fields: { imageData: JSON.stringify(payload) }, files });
      const items = (res.data.sections ?? []).flatMap((s) => s.mediaItems ?? s.images ?? []);
      if ((res.data.sections?.length ?? 0) !== 3) throw new Error(`esperava 3 seções, veio ${res.data.sections?.length}`);
      ctx.createdImagePages.push(res.data);
      return `id=${res.data.id} medias=${items.length}`;
    });
  }

  await logger.check('POST /image-pages sem public responde 400/422', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/image-pages', fields: { imageData: JSON.stringify({ title: 'x', description: 'y', sections: [] }) }, files: {} }), [400, 422], 'gallery sem public'),
  );
  await logger.check('POST /image-pages upload sem fieldKey responde 400/422', async () => {
    const { item } = uploadMedia('png', 'x');
    delete item.fieldKey;
    return expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/image-pages', fields: { imageData: JSON.stringify({ title: 'x', description: 'y', public: true, sections: [{ caption: 'c', description: 'd', public: true, mediaItems: [item] }] }) }, files: {} }), [400, 422], 'gallery sem fieldKey');
  });
  if (as.teacher) {
    await logger.check('POST /image-pages como professor responde 403', () =>
      expectHttpError(() => multipartRequest({ http: as.teacher, method: 'POST', path: '/image-pages', fields: { imageData: '{}' }, files: {} }), 403, 'gallery teacher'),
    );
  }
  return { created: ctx.createdImagePages };
}

module.exports = { run };
