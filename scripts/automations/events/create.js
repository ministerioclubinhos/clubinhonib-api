const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { toDateOnly, pick } = require('../common/random');

function isoDatePlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

/** Eventos com capa real (JPG/PNG), por link e sem mídia; público e restrito por audiência. */
async function run({ http, logger, ctx }) {
  logger.section('events/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdEvents = [];

  const list = await http.request('get', '/events');
  const existing = Array.isArray(list.data) ? list.data : [];
  const toCreate = Math.max(3, min - existing.filter((e) => !e.clubId).length);

  for (let i = 0; i < toCreate; i++) {
    const variant = i % 3;
    const eventData = {
      title: `Evento da automação #${existing.length + i + 1}`,
      date: isoDatePlus(7 + i * 3),
      location: pick(['Templo NIB', 'Salão social', 'Praça do bairro']),
      description: 'Evento criado pelos scripts de automação',
      audience: pick(['all', 'teachers', 'coordinators']),
      eventType: pick(['visit', 'meeting', 'custom']),
      ...(variant === 0 ? { media: { title: 'Capa', description: 'JPG real', uploadType: 'upload', mediaType: 'image', isLocalFile: true } } : {}),
      ...(variant === 1 ? { media: { title: 'Capa por link', description: 'link', uploadType: 'link', mediaType: 'image', isLocalFile: false, url: 'https://picsum.photos/seed/evento/600/300', platformType: 'ANY' } } : {}),
    };
    await logger.check(`POST /events ${variant === 0 ? 'upload jpg' : variant === 1 ? 'link' : 'sem mídia'}`, async () => {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/events',
        fields: { eventData: JSON.stringify(eventData) },
        files: variant === 0 ? { file: fixture(i % 2 ? 'jpg' : 'png', { seed: i, name: `capa-${i}.${i % 2 ? 'jpg' : 'png'}` }) } : {},
      });
      if (variant === 0 && !res.data.media?.url) throw new Error('capa não veio na resposta');
      ctx.createdEvents.push(res.data);
      return `id=${res.data.id} date=${res.data.date}`;
    });
  }

  await logger.check('POST /events com date inválida responde 400/422', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/events', fields: { eventData: JSON.stringify({ title: 'x', date: 'ontem', location: 'y', description: 'z' }) }, files: {} }), [400, 422], 'event date'),
  );
  await logger.check('POST /events sem eventData responde 400/422', () =>
    expectHttpError(() => multipartRequest({ http, method: 'POST', path: '/events', fields: {}, files: {} }), [400, 422], 'event sem payload'),
  );
  if (as.coordinator) {
    await logger.check('POST /events como coordenador responde 403', () =>
      expectHttpError(() => multipartRequest({ http: as.coordinator, method: 'POST', path: '/events', fields: { eventData: '{}' }, files: {} }), 403, 'event coord'),
    );
  }
  return { created: ctx.createdEvents };
}

module.exports = { run };
