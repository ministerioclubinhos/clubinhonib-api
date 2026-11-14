const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');

const patch = (http, id, eventData, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/events/${id}`, fields: eventData === null ? {} : { eventData: JSON.stringify(eventData) }, files });

/** `PATCH /events/:id`: texto, data, público, tipo, capa (arquivo/link/mantida), validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('events/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const created = (await multipartRequest({ http, method: 'POST', path: '/events', fields: { eventData: JSON.stringify({ title: 'Evento para editar', date: '2098-03-10', location: 'Local', description: 'Desc', audience: 'all', eventType: 'custom', media: { title: 'Capa', description: 'png', uploadType: 'upload', mediaType: 'image', isLocalFile: true } }) }, files: { file: fixture('png', { seed: 9 }) } })).data;
  const id = created.id;

  await logger.check('PATCH edita título, descrição, data, local, público e tipo', async () => {
    const body = { title: 'Evento Editado', description: 'Descrição editada', date: '2098-04-11', location: 'Novo local', audience: 'teachers', eventType: 'meeting' };
    const res = await patch(http, id, body);
    for (const [k, v] of Object.entries(body)) if (res.data[k] !== v) throw new Error(`${k}=${res.data[k]}`);
    if (res.data.media?.url !== created.media?.url) throw new Error('capa perdida na edição de texto');
    return 'ok';
  });
  await logger.check('PATCH parcial (só location) preserva o resto', async () => {
    const res = await patch(http, id, { location: 'Só o local' });
    if (res.data.location !== 'Só o local' || res.data.title !== 'Evento Editado') throw new Error('parcial');
    return 'ok';
  });
  await logger.check('PATCH troca a capa por arquivo novo (JPG)', async () => {
    const before = (await http.request('get', `/events/${id}`)).data.media?.url;
    const res = await patch(http, id, { media: { title: 'Capa nova', description: 'jpg', uploadType: 'upload', mediaType: 'image', isLocalFile: true } }, { file: fixture('jpg') });
    if (!res.data.media?.url || res.data.media.url === before) throw new Error('capa não trocada');
    return res.data.media.url.split('/').pop();
  });
  await logger.check('PATCH troca a capa por link', async () => {
    const res = await patch(http, id, { media: { title: 'Capa link', description: 'link', uploadType: 'link', mediaType: 'image', isLocalFile: false, url: 'https://picsum.photos/seed/evt/600/300' } });
    if (res.data.media?.isLocalFile !== false) throw new Error('link');
    return res.data.media.url;
  });
  await logger.check('PATCH com date inválida responde 400/422', () => expectHttpError(() => patch(http, id, { date: 'amanhã' }), [400, 422], 'date'));
  await logger.check('PATCH com audience inválida responde 400/422', () => expectHttpError(() => patch(http, id, { audience: 'todos' }), [400, 422], 'audience'));
  await logger.check('PATCH com campo desconhecido responde 400/422', () => expectHttpError(() => patch(http, id, { public: false }), [400, 422], 'whitelist'));
  await logger.check('PATCH sem eventData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { title: 'x' }), 404, '404'));
  await logger.check('PATCH com uuid inválido responde 400/422', () => expectHttpError(() => patch(http, 'x', { title: 'x' }), [400, 422], 'uuid'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /events/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { title: 'x' }), 403, role));
  }
  await logger.check('PATCH /events/:id anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { title: 'x' }), 401, 'anônimo'));
  await http.request('delete', `/events/${id}`);
  return { ok: true };
}

module.exports = { run };
