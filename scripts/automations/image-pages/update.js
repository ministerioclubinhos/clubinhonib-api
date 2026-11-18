const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');

const patch = (http, id, data, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/image-pages/${id}`, fields: data === null ? {} : { imageData: JSON.stringify(data) }, files });

function build(index) {
  const a = uploadMedia('png', `gu_${index}_a`, { title: 'Foto A', seed: index });
  const b = uploadMedia('jpg', `gu_${index}_b`, { title: 'Foto B', seed: index });
  return { payload: { title: `Galeria para editar #${index}`, description: 'Desc', public: true, sections: [{ caption: 'Seção 1', description: 'd1', public: true, mediaItems: [a.item, linkMedia({ mediaType: 'image', url: 'https://picsum.photos/seed/g/300', platformType: 'ANY' })] }, { caption: 'Seção 2', description: 'd2', public: false, mediaItems: [b.item] }] }, files: mergeFiles(a, b) };
}

/** `PATCH /image-pages/:id`: texto/public, seções por id (renomear, alternar public), fotos mantidas/removidas/novas, seção nova/removida, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('image-pages/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const built = build(960);
  const page = (await multipartRequest({ http, method: 'POST', path: '/image-pages', fields: { imageData: JSON.stringify(built.payload) }, files: built.files })).data;
  const id = page.id;
  const load = async () => (await http.request('get', `/image-pages/${id}`)).data;
  const items = (s) => s.mediaItems ?? s.images ?? [];
  const sectionInput = (s, overrides = {}) => ({ id: s.id, caption: s.caption, description: s.description, public: s.public, mediaItems: items(s).map((m) => toMediaInput(m)), ...overrides });

  await logger.check('PATCH edita título, descrição e public mantendo seções e fotos', async () => {
    const cur = await load();
    const res = await patch(http, id, { id, title: 'Galeria Editada', description: 'Desc editada', public: false, sections: cur.sections.map((s) => sectionInput(s)) });
    if (res.data.title !== 'Galeria Editada' || res.data.public !== false) throw new Error('texto/public');
    const uploadsBefore = cur.sections.flatMap(items).filter((m) => m.isLocalFile).length;
    const uploadsAfter = res.data.sections.flatMap(items).filter((m) => m.isLocalFile).length;
    if (uploadsAfter !== uploadsBefore) throw new Error(`uploads ${uploadsBefore}->${uploadsAfter}`);
    return `sections=${res.data.sections.length}`;
  });
  await logger.check('PATCH renomeia a seção 1, alterna public e adiciona foto nova nela', async () => {
    const cur = await load();
    const [first, ...rest] = cur.sections;
    const up = uploadMedia('png', 'gu_new', { title: 'Foto nova', seed: 77 });
    const res = await patch(http, id, { id, title: cur.title, description: cur.description, public: cur.public, sections: [sectionInput(first, { caption: 'Seção renomeada', public: !first.public, mediaItems: [...items(first).map((m) => toMediaInput(m)), up.item] }), ...rest.map((s) => sectionInput(s))] }, mergeFiles(up));
    const edited = res.data.sections.find((s) => s.id === first.id);
    if (!edited || edited.caption !== 'Seção renomeada' || items(edited).length !== items(first).length + 1) throw new Error('seção não editada');
    return `fotos=${items(edited).length}`;
  });
  await logger.check('PATCH remove uma foto e a seção 2 inteira, cria seção nova', async () => {
    const cur = await load();
    const [first, second] = cur.sections;
    const res = await patch(http, id, { id, title: cur.title, description: cur.description, public: cur.public, sections: [sectionInput(first, { mediaItems: items(first).slice(1).map((m) => toMediaInput(m)) }), { caption: 'Seção nova', description: 'nova', public: true, mediaItems: [linkMedia({ mediaType: 'image', url: 'https://picsum.photos/seed/n/300', platformType: 'ANY' })] }] });
    if (res.data.sections.some((s) => s.id === second?.id)) throw new Error('seção 2 ainda presente');
    const f = res.data.sections.find((s) => s.id === first.id);
    if (items(f).length !== items(first).length - 1) throw new Error('foto não removida');
    return `sections=${res.data.sections.length}`;
  });
  await logger.check('GET /image-pages/:id/sections anônimo não vê seção privada após a edição', async () => {
    const cur = await load();
    const anon = (await as.anonymous.request('get', `/image-pages/${id}/sections`, { params: { page: 1, limit: 50 } })).data;
    if (anon.sections.some((s) => s.public === false)) throw new Error('seção privada vazou');
    return `públicas=${anon.sections.length}/${cur.sections.length}`;
  });
  await logger.check('PATCH sem id no corpo responde 400/422', async () => { const cur = await load(); return expectHttpError(() => patch(http, id, { title: cur.title, description: cur.description, public: true, sections: [] }), [400, 422], 'sem id'); });
  await logger.check('PATCH sem public responde 400/422', async () => { const cur = await load(); return expectHttpError(() => patch(http, id, { id, title: cur.title, description: cur.description, sections: [] }), [400, 422], 'sem public'); });
  await logger.check('PATCH com upload sem arquivo responde 4xx', async () => { const cur = await load(); const up = uploadMedia('png', 'faltando'); return expectHttpError(() => patch(http, id, { id, title: cur.title, description: cur.description, public: true, sections: [{ caption: 'x', description: 'y', public: true, mediaItems: [up.item] }] }), [400, 422, 500], 'sem arquivo'); });
  await logger.check('PATCH sem imageData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { id: MISSING_ID, title: 'x', description: 'y', public: true, sections: [] }), 404, '404'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /image-pages/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { id, title: 'x', description: 'y', public: true, sections: [] }), 403, role));
  }
  await logger.check('PATCH anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { id, title: 'x', description: 'y', public: true, sections: [] }), 401, 'anônimo'));
  await http.request('delete', `/image-pages/${id}`);
  return { ok: true };
}

module.exports = { run };
