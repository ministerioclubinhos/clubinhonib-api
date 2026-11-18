const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { toDateOnly } = require('../common/random');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const VERSES = ['João 3:16', 'Salmos 23:1', 'Romanos 8:28', 'Provérbios 3:5', 'Mateus 5:9', 'Filipenses 4:13', 'Isaías 41:10'];

function parseLocal(value) {
  const [y, m, d] = String(value).split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextMonday(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}

/** Semanas (segunda a sexta) livres, sem sobrepor as meditações existentes. */
function freeWeeks(existing, count) {
  const ranges = existing.map((m) => ({ start: parseLocal(m.startDate), end: parseLocal(m.endDate) }));
  const conflicts = (s, e) => ranges.some((r) => s <= r.end && e >= r.start);
  const weeks = [];
  let start = nextMonday(new Date());
  for (let i = 0; i < 200 && weeks.length < count; i++) {
    const end = addDays(start, 4);
    if (!conflicts(start, end)) weeks.push({ startDate: toDateOnly(start), endDate: toDateOnly(end) });
    start = addDays(start, 7);
  }
  return weeks;
}

function buildMeditation({ startDate, endDate, index, uploaded = true }) {
  return {
    topic: `Meditação da automação #${index}`,
    startDate,
    endDate,
    media: uploaded
      ? { title: 'Áudio da semana', description: 'MP3 real', uploadType: 'upload', mediaType: 'audio', isLocalFile: true }
      : { title: 'Áudio no Drive', description: 'link', uploadType: 'link', mediaType: 'audio', isLocalFile: false, url: 'https://drive.google.com/file/d/automation-audio/view', platformType: 'googledrive' },
    days: DAYS.map((day, i) => ({ day, verse: VERSES[(index + i) % VERSES.length], topic: `Tema ${i + 1} da semana ${index}` })),
  };
}

/** Meditação semanal: multipart `meditationData` + arquivo `file` (MP3 real); segunda a sexta, sem sobreposição. */
async function run({ http, logger, ctx }) {
  logger.section('meditations/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdMeditations = [];

  const existing = await fetchAllPages(http.request, 'get', '/meditations', {}, { limit: 100 });
  const toCreate = Math.max(2, min - existing.length);
  const weeks = freeWeeks(existing, toCreate);

  for (const [i, week] of weeks.entries()) {
    const uploaded = i % 3 !== 2;
    await logger.check(`POST /meditations ${week.startDate}..${week.endDate} (${uploaded ? 'upload mp3' : 'link'})`, async () => {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/meditations',
        fields: { meditationData: JSON.stringify(buildMeditation({ ...week, index: existing.length + i + 1, uploaded })) },
        files: uploaded ? { file: fixture('mp3', { name: `meditacao-${week.startDate}.mp3` }) } : {},
      });
      if ((res.data.days?.length ?? 0) !== 5) throw new Error('esperava 5 dias');
      ctx.createdMeditations.push(res.data);
      return `id=${res.data.id}`;
    });
  }

  const first = ctx.createdMeditations[0];
  if (first) {
    await logger.check('POST /meditations sobreposta responde 409', () =>
      expectHttpError(
        () => multipartRequest({ http, method: 'POST', path: '/meditations', fields: { meditationData: JSON.stringify(buildMeditation({ startDate: first.startDate, endDate: first.endDate, index: 99, uploaded: false })) }, files: {} }),
        409,
        'meditação sobreposta',
      ),
    );
  }
  const tuesday = weeks[0] ? toDateOnly(addDays(parseLocal(weeks[0].startDate), 1)) : null;
  if (tuesday) {
    await logger.check('POST /meditations começando numa terça responde 400/422', () =>
      expectHttpError(
        () => multipartRequest({ http, method: 'POST', path: '/meditations', fields: { meditationData: JSON.stringify(buildMeditation({ startDate: tuesday, endDate: toDateOnly(addDays(parseLocal(tuesday), 3)), index: 98, uploaded: false })) }, files: {} }),
        [400, 422],
        'meditação terça',
      ),
    );
  }
  await logger.check('POST /meditations com 4 dias responde 400/422', async () => {
    const body = buildMeditation({ startDate: '2099-01-04', endDate: '2099-01-08', index: 97, uploaded: false });
    body.days.pop();
    return expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/meditations', fields: { meditationData: JSON.stringify(body) }, files: {} }), [400, 422], 'meditação 4 dias');
  });
  await logger.check('POST /meditations upload sem arquivo responde 400/422', () =>
    expectHttpError(
      () => multipartRequest({ http, method: 'POST', path: '/meditations', fields: { meditationData: JSON.stringify(buildMeditation({ startDate: '2099-02-01', endDate: '2099-02-05', index: 96, uploaded: true })) }, files: {} }),
      [400, 422],
      'meditação sem arquivo',
    ),
  );
  if (as.teacher) {
    await logger.check('POST /meditations como professor responde 403', () =>
      expectHttpError(() => multipartRequest({ http: as.teacher, method: 'POST', path: '/meditations', fields: { meditationData: '{}' }, files: {} }), 403, 'meditação teacher'),
    );
  }
  return { created: ctx.createdMeditations };
}

module.exports = { run, buildMeditation };
