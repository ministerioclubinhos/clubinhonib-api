const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { MISSING_ID } = require('../common/update-helpers');
const { buildMeditation } = require('./create');
const { toDateOnly } = require('../common/random');

const patch = (http, id, meditationData, files = {}) =>
  multipartRequest({ http, method: 'PATCH', path: `/meditations/${id}`, fields: meditationData === null ? {} : { meditationData: JSON.stringify(meditationData) }, files });

function parseLocal(v) { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d, 12); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }

/** `PATCH /meditations/:id`: tema, datas (segunda→sexta), dias, mídia por link e por arquivo, sobreposição, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('meditations/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const existing = await fetchAllPages(http.request, 'get', '/meditations', {}, { limit: 100 });
  // Duas semanas livres em 2098 (bem longe de qualquer meditação real).
  // Segunda-feira de 2098: a data-base é ajustada pelo dia da semana real.
  let monday = parseLocal('2098-01-05');
  while (monday.getDay() !== 1) monday = addDays(monday, 1);
  const taken = existing.map((m) => [parseLocal(m.startDate), parseLocal(m.endDate)]);
  const free = () => { while (taken.some(([s, e]) => monday <= e && addDays(monday, 4) >= s)) monday = addDays(monday, 7); const w = { startDate: toDateOnly(monday), endDate: toDateOnly(addDays(monday, 4)) }; monday = addDays(monday, 7); return w; };
  const w1 = free();
  const w2 = free();
  const created = (await multipartRequest({ http, method: 'POST', path: '/meditations', fields: { meditationData: JSON.stringify(buildMeditation({ ...w1, index: 901, uploaded: false })) }, files: {} })).data;
  const other = (await multipartRequest({ http, method: 'POST', path: '/meditations', fields: { meditationData: JSON.stringify(buildMeditation({ ...w2, index: 902, uploaded: false })) }, files: {} })).data;
  const id = created.id;

  await logger.check('PATCH edita tema, datas e os 5 dias', async () => {
    const w3 = free();
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, i) => ({ day, verse: `Gênesis 1:${i + 1}`, topic: `Dia ${i + 1} editado` }));
    const res = await patch(http, id, { id, topic: 'Tema editado', startDate: w3.startDate, endDate: w3.endDate, days });
    if (res.data.topic !== 'Tema editado' || res.data.startDate !== w3.startDate) throw new Error('tema/datas');
    if (res.data.days.length !== 5 || !res.data.days.every((d) => d.topic.endsWith('editado'))) throw new Error('dias');
    return `${w3.startDate}..${w3.endDate}`;
  });
  await logger.check('PATCH parcial (só topic) preserva dias e datas', async () => {
    const before = (await http.request('get', `/meditations/${id}`)).data;
    const res = await patch(http, id, { topic: 'Só o tema' });
    if (res.data.topic !== 'Só o tema' || res.data.startDate !== before.startDate || res.data.days.length !== 5) throw new Error('parcial');
    return 'ok';
  });
  await logger.check('PATCH troca a mídia de link para arquivo MP3 e depois para link', async () => {
    const up = await patch(http, id, { media: { title: 'Áudio', description: 'mp3', uploadType: 'upload', mediaType: 'audio', isLocalFile: true } }, { file: fixture('mp3') });
    if (up.data.media?.isLocalFile !== true) throw new Error('upload');
    const link = await patch(http, id, { media: { title: 'Drive', description: 'link', uploadType: 'link', mediaType: 'audio', isLocalFile: false, url: 'https://drive.google.com/file/d/med/view', platformType: 'googledrive' } });
    if (link.data.media?.isLocalFile !== false) throw new Error('link');
    return 'ok';
  });
  await logger.check('PATCH movendo para as datas de outra meditação responde 409', () =>
    expectHttpError(() => patch(http, id, { startDate: other.startDate, endDate: other.endDate }), 409, 'sobreposição'));
  await logger.check('PATCH com startDate numa terça responde 400/422', () =>
    expectHttpError(() => patch(http, id, { startDate: toDateOnly(addDays(parseLocal(w1.startDate), 1)), endDate: w1.endDate }), [400, 422], 'terça'));
  await logger.check('PATCH com 4 dias responde 400/422', () =>
    expectHttpError(() => patch(http, id, { days: buildMeditation({ ...w1, index: 1 }).days.slice(0, 4) }), [400, 422], '4 dias'));
  await logger.check('PATCH com dia inválido responde 400/422', () =>
    expectHttpError(() => patch(http, id, { days: buildMeditation({ ...w1, index: 1 }).days.map((d, i) => (i === 0 ? { ...d, day: 'Sunday' } : d)) }), [400, 422], 'dia'));
  await logger.check('PATCH sem meditationData responde 400/422', () => expectHttpError(() => patch(http, id, null), [400, 422], 'sem payload'));
  await logger.check('PATCH em id inexistente responde 404', () => expectHttpError(() => patch(http, MISSING_ID, { topic: 'x' }), 404, '404'));
  await logger.check('PATCH com uuid inválido responde 400/422', () => expectHttpError(() => patch(http, 'x', { topic: 'x' }), [400, 422], 'uuid'));
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /meditations/:id como ${role} responde 403`, () => expectHttpError(() => patch(as[role], id, { topic: 'x' }), 403, role));
  }
  await logger.check('PATCH /meditations/:id anônimo responde 401', () => expectHttpError(() => patch(as.anonymous, id, { topic: 'x' }), 401, 'anônimo'));
  await http.request('delete', `/meditations/${id}`);
  await http.request('delete', `/meditations/${other.id}`);
  return { ok: true };
}

module.exports = { run };
