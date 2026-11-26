const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/**
 * Listagem paginada com filtros, simples, detalhe, por clubinho, mover
 * clubinho entre coordenadores, desvincular e escopo por papel.
 */
async function run({ http, logger, ctx }) {
  logger.section('coordinator-profiles/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const coords = await fetchAllPages(http.request, 'get', '/coordinator-profiles', { sort: 'createdAt', order: 'desc' }, { limit: 100, maxPages: 200 });
  const empty = coords.filter((c) => !(Array.isArray(c.clubs) && c.clubs.length)).length;
  logger.ok(`GET /coordinator-profiles todas as páginas total=${coords.length} semClubinho=${empty}`);

  for (const params of [{ hasClubs: true }, { active: true, q: 'automa' }, ...(ctx.clubs?.[0] ? [{ clubNumber: ctx.clubs[0].number }] : [])]) {
    await logger.check(`GET /coordinator-profiles filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/coordinator-profiles', { params: { ...params, page: 1, limit: 20 } });
      if (params.hasClubs && res.data.items.some((c) => !c.clubs?.length)) throw new Error('hasClubs=true devolveu coordenador sem clubinho');
      return `items=${res.data.items.length} total=${res.data.total}`;
    });
  }

  await logger.check('GET /coordinator-profiles/simple', async () => {
    const res = await http.request('get', '/coordinator-profiles/simple');
    if (!Array.isArray(res.data) || (res.data.length && !('coordinatorProfileId' in res.data[0]))) throw new Error('contrato inesperado');
    return `total=${res.data.length}`;
  });

  const withClub = coords.find((c) => c.clubs?.length);
  if (withClub) {
    await logger.check(`GET /coordinator-profiles/${withClub.id} e by-club/${withClub.clubs[0].id}`, async () => {
      const [one, byClub] = await Promise.all([
        http.request('get', `/coordinator-profiles/${withClub.id}`),
        http.request('get', `/coordinator-profiles/by-club/${withClub.clubs[0].id}`),
      ]);
      if (byClub.data?.id !== one.data.id) throw new Error('by-club devolveu outro coordenador');
      return `clubs=${one.data.clubs.length}`;
    });
  }

  const extra = ctx.extraCoordinatorProfileId;
  const anchorCoordinator = ctx.coordinatorProfileId;
  if (extra && anchorCoordinator && extra !== anchorCoordinator) {
    await logger.check('move-club transfere o clubinho e unassign-club o solta', async () => {
      const detail = await http.request('get', `/coordinator-profiles/${extra}`);
      const club = detail.data?.clubs?.[0];
      if (!club) return 'coordenador extra sem clubinho; pulado';
      await http.request('patch', `/coordinator-profiles/${extra}/move-club`, { data: { clubId: club.id, toCoordinatorProfileId: anchorCoordinator } });
      const moved = await http.request('get', `/coordinator-profiles/${anchorCoordinator}`);
      if (!moved.data.clubs.some((c) => c.id === club.id)) throw new Error('clubinho não chegou ao destino');
      await http.request('patch', `/coordinator-profiles/${anchorCoordinator}/unassign-club`, { data: { clubId: club.id } });
      const freed = await http.request('get', `/clubs/${club.id}`);
      if (freed.data.coordinator) throw new Error('clubinho ainda tem coordenador');
      await http.request('patch', `/coordinator-profiles/${extra}/assign-club`, { data: { clubId: club.id } });
      return `club #${club.number} movido e devolvido`;
    });
  }

  if (as.coordinator) {
    await logger.check('GET /coordinator-profiles como coordenador é permitido', async () => {
      const res = await as.coordinator.request('get', '/coordinator-profiles', { params: { page: 1, limit: 5 } });
      return `items=${res.data.items.length}`;
    });
    if (extra && ctx.clubs?.[0]) {
      await logger.check('move-club como coordenador responde 403', () =>
        expectHttpError(() => as.coordinator.request('patch', `/coordinator-profiles/${extra}/move-club`, { data: { clubId: ctx.clubs[0].id, toCoordinatorProfileId: extra } }), 403, 'move coord'),
      );
    }
  }
  if (as.teacher) {
    await logger.check('GET /coordinator-profiles como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('get', '/coordinator-profiles'), 403, 'coords teacher'),
    );
  }
  await logger.check('GET /coordinator-profiles/:id com uuid inválido responde 400/422', () =>
    expectHttpError(() => http.request('get', '/coordinator-profiles/xyz'), [400, 422], 'coords uuid'),
  );

  return { coordinators: coords, withZeroClubs: empty };
}

module.exports = { run };
