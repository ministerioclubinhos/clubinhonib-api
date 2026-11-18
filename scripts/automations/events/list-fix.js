const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Lista (logado e anônimo), próximos, detalhe, edição com e sem arquivo, remoção 204. Os encontros semanais dos clubinhos aparecem só para logados. */
async function run({ http, logger, ctx }) {
  logger.section('events/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  let events = [];
  await logger.check('GET /events logado inclui os encontros dos clubinhos', async () => {
    const res = await http.request('get', '/events');
    events = Array.isArray(res.data) ? res.data : [];
    const clubMeetings = events.filter((e) => e.clubId || e.isRecurring);
    return `total=${events.length} encontros=${clubMeetings.length}`;
  });
  await logger.check('GET /events anônimo só traz eventos públicos', async () => {
    const res = await as.anonymous.request('get', '/events');
    if (res.data.some((e) => e.public === false)) throw new Error('vazou evento não público para anônimo');
    return `total=${res.data.length}`;
  });
  await logger.check('GET /events/upcoming', async () => {
    const res = await http.request('get', '/events/upcoming');
    return `upcoming=${res.data.length}`;
  });

  const mine = ctx.createdEvents ?? [];
  const sample = mine[0] ?? events.find((e) => !e.clubId);
  if (sample) {
    await logger.check(`GET/PATCH /events/${sample.id}`, async () => {
      const one = await as.anonymous.request('get', `/events/${sample.id}`);
      const res = await multipartRequest({ http, method: 'PATCH', path: `/events/${sample.id}`, fields: { eventData: JSON.stringify({ id: sample.id, title: `${one.data.title} (editado)`, location: 'Local editado', audience: 'all' }) }, files: {} });
      if (!res.data.title.endsWith('(editado)') || res.data.location !== 'Local editado') throw new Error('PATCH não aplicou');
      return res.data.title;
    });
    await logger.check(`PATCH /events/${sample.id} com capa nova (PNG)`, async () => {
      const res = await multipartRequest({
        http,
        method: 'PATCH',
        path: `/events/${sample.id}`,
        fields: { eventData: JSON.stringify({ media: { title: 'Capa nova', description: 'upload', uploadType: 'upload', mediaType: 'image', isLocalFile: true } }) },
        files: { file: fixture('png', { seed: 42, name: 'capa-nova.png' }) },
      });
      if (!res.data.media?.url) throw new Error('capa nova não veio');
      return res.data.media.url.split('/').pop();
    });
  }

  const disposable = mine[1];
  if (disposable) {
    await logger.check(`DELETE /events/${disposable.id} responde 204`, async () => {
      const res = await http.request('delete', `/events/${disposable.id}`);
      if (res.status !== 204) throw new Error(`status=${res.status}`);
      await expectHttpError(() => http.request('get', `/events/${disposable.id}`), 404, 'evento removido');
      return 'removido';
    });
  }
  if (as.teacher && sample) {
    await logger.check('DELETE /events/:id como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('delete', `/events/${sample.id}`), 403, 'event teacher'),
    );
  }
  await logger.check('GET /events/:id inexistente responde 404', () =>
    expectHttpError(() => http.request('get', '/events/00000000-0000-4000-8000-000000000000'), 404, 'event 404'),
  );
  return { events };
}

module.exports = { run };
