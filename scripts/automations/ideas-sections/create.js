const { multipartRequest } = require('../common/multipart');
const { linkMedia, uploadMedia, mergeFiles } = require('../common/media');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Ideia enviada pela base (professor/coordenador): nasce fora do ar, na fila da administração. */
function buildIdeaSection(index) {
  const pdf = uploadMedia('pdf', `idea_pdf_${index}`, { title: 'Passo a passo', seed: index });
  const jpg = uploadMedia('jpg', `idea_img_${index}`, { title: 'Foto da ideia', seed: index });
  return {
    payload: {
      title: `Ideia compartilhada #${index}`,
      description: 'Dinâmica testada no clubinho, enviada pela automação',
      medias: [pdf.item, jpg.item, linkMedia({ mediaType: 'video' })],
    },
    files: mergeFiles(pdf, jpg),
  };
}

async function run({ http, logger, ctx }) {
  logger.section('ideas-sections/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  ctx.createdIdeaSections = [];

  let i = 0;
  for (const [key, client] of Object.entries({ teacher: as.teacher, coordinator: as.coordinator, superuser: http })) {
    if (!client) continue;
    i += 1;
    await logger.check(`POST /ideas-sections como ${key} (pdf + jpg + link)`, async () => {
      const { payload, files } = buildIdeaSection(i);
      const res = await multipartRequest({ http: client, method: 'POST', path: '/ideas-sections', fields: { sectionData: JSON.stringify(payload) }, files });
      if (res.data.public !== false) throw new Error('ideia nova deveria nascer fora do ar');
      if ((res.data.medias?.length ?? 0) !== 3) throw new Error(`esperava 3 mídias, veio ${res.data.medias?.length}`);
      ctx.createdIdeaSections.push(res.data);
      return `id=${res.data.id}`;
    });
  }

  await logger.check('POST /ideas-sections com public no corpo responde 400/422 (whitelist)', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/ideas-sections', fields: { sectionData: JSON.stringify({ title: 'x', description: 'y', public: true, medias: [] }) }, files: {} }), [400, 422], 'idea whitelist'),
  );
  await logger.check('POST /ideas-sections upload sem originalName responde 400/422', async () => {
    const { item } = uploadMedia('pdf', 'idea_x');
    delete item.originalName;
    return expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/ideas-sections', fields: { sectionData: JSON.stringify({ title: 'x', description: 'y', medias: [item] }) }, files: {} }), [400, 422], 'idea sem originalName');
  });
  await logger.check('POST /ideas-sections com mediaType audio responde 400/422 (só video/document/image)', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/ideas-sections', fields: { sectionData: JSON.stringify({ title: 'x', description: 'y', medias: [linkMedia({ mediaType: 'audio', platformType: 'ANY' })] }) }, files: {} }), [400, 422], 'idea audio'),
  );
  await logger.check('POST /ideas-sections anônimo responde 401', () =>
    expectHttpError(() => multipartRequest({ http: as.anonymous, method: 'POST', path: '/ideas-sections', fields: { sectionData: '{}' }, files: {} }), 401, 'idea anônimo'),
  );
  return { created: ctx.createdIdeaSections };
}

module.exports = { run };
