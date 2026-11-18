const { fetchAllPages } = require('../common/pagination');
const { randomJoinedAtWithin, randomJoinedAt } = require('../common/random');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorMessage } = require('../common/errors');
const { buildChild } = require('./create');

/**
 * Listagem paginada (`{ data, meta }`) com filtros, listagem simples, detalhe,
 * edição, ativação, remoção e escopo por papel.
 * Fix: criança sem `joinedAt` recebe uma data (dentro do período letivo).
 */
async function run({ http, logger, ctx }) {
  logger.section('children/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });
  const period = ctx.period ?? null;

  const children = await fetchAllPages(http.request, 'get', '/children', { orderBy: 'name', order: 'ASC' }, { limit: 100 });
  logger.ok(`GET /children todas as páginas total=${children.length} (meta.totalItems=${children.totalReported})`);
  ctx.children = children;

  let fixed = 0;
  for (const child of children) {
    if (!child?.id || child.joinedAt) continue;
    try {
      const joinedAt = period ? randomJoinedAtWithin(period.startDate, period.endDate) : randomJoinedAt();
      await http.request('put', `/children/${child.id}`, { data: { joinedAt } });
      child.joinedAt = joinedAt;
      fixed++;
    } catch (e) {
      logger.warn(`[children/list-fix] fix joinedAt ${child.id}: ${errorMessage(e)}`);
    }
  }
  logger.ok(`[children/list-fix] fixJoinedAt=${fixed}`);

  const club = ctx.clubs?.[0];
  const filters = [
    { isActive: true },
    { searchString: 'Silva' },
    { orderBy: 'birthDate', order: 'desc' },
    { birthDateFrom: '2015-01-01', birthDateTo: '2020-12-31' },
    ...(period ? [{ joinedFrom: period.startDate, joinedTo: period.endDate }] : []),
    { city: 'São Paulo' },
    ...(club ? [{ clubId: club.id }, { clubNumber: club.number }] : []),
  ];
  for (const params of filters) {
    await logger.check(`GET /children filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/children', { params: { ...params, page: 1, limit: 20 } });
      if (params.clubId && res.data.data.some((c) => c.club?.id !== params.clubId)) throw new Error('filtro clubId vazou');
      if (params.isActive && res.data.data.some((c) => c.isActive !== true)) throw new Error('filtro isActive vazou');
      return `data=${res.data.data.length} totalItems=${res.data.meta.totalItems}`;
    });
  }

  await logger.check('GET /children com orderBy inválido responde 400/422', () =>
    expectHttpError(() => http.request('get', '/children', { params: { orderBy: 'hacker' } }), [400, 422], 'children orderBy'),
  );

  await logger.check('GET /children/simple todas as páginas e filtro acceptedChrist', async () => {
    const simple = await fetchAllPages(http.request, 'get', '/children/simple', {}, { limit: 100 });
    const withDecision = await http.request('get', '/children/simple', { params: { acceptedChrist: true, page: 1, limit: 50 } });
    if (withDecision.data.data.some((c) => !c.acceptedChrists?.length)) throw new Error('acceptedChrist=true devolveu criança sem decisão');
    return `simple=${simple.length} comDecisão=${withDecision.data.meta.totalItems}`;
  });

  const sample = children.find((c) => c.club?.id) ?? children[0];
  if (sample) {
    await logger.check(`GET /children/${sample.id}`, async () => {
      const res = await http.request('get', `/children/${sample.id}`);
      for (const f of ['birthDate', 'guardianName', 'joinedAt', 'club', 'address']) if (!(f in res.data)) throw new Error(`campo ausente ${f}`);
      return res.data.name;
    });
  }

  await logger.check('ciclo POST→PUT→toggle-active→DELETE de criança descartável', async () => {
    const created = await http.request('post', '/children', { data: buildChild({ clubId: club?.id, period, withAddress: true }) });
    const id = created.data.id;
    const upd = await http.request('put', `/children/${id}`, {
      data: { name: 'Criança Editada', guardianPhone: '', clubId: null, address: { city: 'Santos', state: 'SP' } },
    });
    if (upd.data.name !== 'Criança Editada' || upd.data.club !== null) throw new Error('PUT não aplicou name/clubId=null');
    const toggled = await http.request('patch', `/children/${id}/toggle-active`);
    if (toggled.data.isActive === upd.data.isActive) throw new Error('toggle não inverteu');
    await http.request('patch', `/children/${id}/toggle-active`);
    const del = await http.request('delete', `/children/${id}`);
    if (del.data?.ok !== true) throw new Error('DELETE sem ok=true');
    await expectHttpError(() => http.request('get', `/children/${id}`), 404, 'criança removida');
    return `id=${id}`;
  });

  if (as.teacher) {
    await logger.check('GET /children como professor só traz o próprio clubinho (ou sem clubinho)', async () => {
      const me = await as.teacher.request('get', '/auth/me');
      const own = me.data?.teacherProfile?.club?.id;
      const list = await fetchAllPages(as.teacher.request, 'get', '/children', {}, { limit: 100 });
      const strangers = list.filter((c) => c.club && c.club.id !== own);
      if (strangers.length) throw new Error(`professor viu ${strangers.length} crianças de outro clubinho`);
      return `visíveis=${list.length}`;
    });
    const ownClubId = (await as.teacher.request('get', '/auth/me')).data?.teacherProfile?.club?.id;
    const foreign = children.find((c) => c.club?.id && c.club.id !== ownClubId);
    if (foreign) {
      await logger.check('GET /children/:id de outro clubinho como professor responde 404', () =>
        expectHttpError(() => as.teacher.request('get', `/children/${foreign.id}`), [403, 404], 'child teacher alheio'),
      );
    }
  }
  if (as.coordinator) {
    await logger.check('GET /children como coordenador só traz os próprios clubinhos', async () => {
      const me = await as.coordinator.request('get', '/auth/me');
      const own = new Set((me.data?.coordinatorProfile?.clubs ?? []).map((c) => c.id));
      const list = await fetchAllPages(as.coordinator.request, 'get', '/children', {}, { limit: 100 });
      const strangers = list.filter((c) => c.club && !own.has(c.club.id));
      if (strangers.length) throw new Error(`coordenador viu ${strangers.length} crianças de outra coordenação`);
      return `visíveis=${list.length}`;
    });
  }
  await logger.check('GET /children anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/children'), 401, 'children anônimo'),
  );

  ctx.children = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100 });
  return { children: ctx.children, fixedJoinedAt: fixed };
}

module.exports = { run };
