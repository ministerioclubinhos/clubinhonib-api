const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, toMediaInput, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');
const { buildIdeasPage } = require('./create');

const patch = (http, id, data, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/ideas-pages/${id}`, fields: data === null ? {} : { ideasMaterialsPageData: JSON.stringify(data) }, files });

/** `PATCH /ideas-pages/:id`: texto, visibilidade, seções mantidas/criadas/removidas, mídias mantidas/adicionadas/removidas, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('ideas-pages/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const built = buildIdeasPage(950);
  const page = (await multipartRequest({ http, method: 'POST', path: '/ideas-pages', fields: { ideasMaterialsPageData: JSON.stringify(built.payload) }, files: built.files })).data;
  const id = page.id;
  const load = async () => (await http.request('get', `/ideas-pages/${id}`)).data;
  const sectionInput = (s, overrides = {}) => ({ id: s.id, title: s.title, description: s.description, public: s.public, medias: (s.medias ?? []).map((m) => toMediaInput(m)), ...overrides });

  await logger.check('PATCH edita título, subtítulo, descrição e public mantendo as seções por id', async () => {
    const cur = await load();
    const res = await patch(http, id, { id, title: 'Ideias Editadas', subtitle: 'Sub editado', description: 'Desc editada', public: true, sections: cur.sections.map((s) => sectionInput(s)) });
    if (res.data.title !== 'Ideias Editadas' || res.data.public !== true) throw new Error('texto/public');
    if (res.data.sections.length !== cur.sections.length) throw new Error('seções perdidas');
    const uploads = res.data.sections.flatMap((s) => s.medias).filter((m) => m.isLocalFile);
    if (uploads.length !== cur.sections.flatMap((s) => s.medias).filter((m) => m.isLocalFile).length) throw new Error('uploads perdidos');
    return `sections=${res.data.sections.length}`;
  });
  await logger.check('PATCH renomeia uma seção e alterna a visibilidade dela', async () => {
    const cur = await load();
    const [first, ...rest] = cur.sections;
    const res = await patch(http, id, { id, title: cur.title, description: cur.description, sections: [sectionInput(first, { title: 'Seção renomeada', public: !first.public }), ...rest.map((s) => sectionInput(s))] });
    const edited = res.data.sections.find((s) => s.id === first.id);
    if (!edited || edited.title !== 'Seção renomeada' || edited.public === first.public) throw new Error('seção não editada');
    return 'ok';
  });
  await logger.check('PATCH remove uma mídia de uma seção e adiciona um upload novo', async () => {
    const cur = await load();
    const target = cur.sections.find((s) => s.medias.length >= 2) ?? cur.sections[0];
    const up = uploadMedia('pdf', 'ideas_new_media', { title: 'PDF novo' });
    const kept = target.medias.slice(1).map((m) => toMediaInput(m));
    const res = await patch(http, id, { id, title: cur.title, description: cur.description, sections: cur.sections.map((s) => (s.id === target.id ? sectionInput(s, { medias: [...kept, up.item, linkMedia({ mediaType: 'video' })] }) : sectionInput(s))) }, mergeFiles(up));
    const after = res.data.sections.find((s) => s.id === target.id);
    if (after.medias.length !== kept.length + 2) throw new Error(`medias=${after.medias.length}`);
    if (after.medias.some((m) => m.id === target.medias[0].id)) throw new Error('mídia removida ainda presente');
    return `medias=${after.medias.length}`;
  });
  await logger.check('PATCH remove uma seção inteira e cria outra nova', async () => {
    const cur = await load();
    const [drop, ...rest] = cur.sections;
    const res = await patch(http, id, { id, title: cur.title, description: cur.description, sections: [...rest.map((s) => sectionInput(s)), { title: 'Seção nova', description: 'Criada na edição', public: true, medias: [linkMedia({ mediaType: 'document', url: 'https://drive.google.com/x', platformType: 'googledrive' })] }] });
    if (res.data.sections.some((s) => s.id === drop.id)) throw new Error('seção removida ainda presente');
    if (!res.data.sections.some((s) => s.title === 'Seção nova')) throw new Error('seção nova ausente');
    return `sections=${res.data.sections.length}`;
  });
  await logger.check('PATCH com sections vazio esvazia a página', async () => {
    const cur = await load();
    const res = await patch(http, id, { id, title: cur.title, description: cur.description, sections: [] });
    if (res.data.sections.length !== 0) throw new Error('não esvaziou');
    return 'ok';
  });
  await logger.check('PATCH sem title responde 400/422', async () => { const cur = await load(); return expectHttpError(() => patch(http, id, { id, description: cur.description, sections: [] }), [400, 422], 'sem title'); });
  await logger.check('PATCH com upload sem arquivo responde 4xx', async () => { const cur = await load(); const up = uploadMedia('pdf', 'faltando'); return expectHttpError(() => patch(http, id, { id, title: cur.title, description: cur.description, sections: [{ title: 'x', description: 'y', medias: [up.item] }] }), [400, 422, 500], 'sem arquivo'); });
  await logger.check('PATCH sem ideasMaterialsPageData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { title: 'x', description: 'y', sections: [] }), 404, '404'));
  await logger.check('PATCH com uuid inválido responde 400/422', () => expectHttpError(() => patch(http, 'x', { title: 'x', description: 'y', sections: [] }), [400, 422], 'uuid'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /ideas-pages/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { title: 'x', description: 'y', sections: [] }), 403, role));
  }
  await logger.check('PATCH anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { title: 'x', description: 'y', sections: [] }), 401, 'anônimo'));
  await http.request('delete', `/ideas-pages/${id}`);
  return { ok: true };
}

module.exports = { run };
