const { ensureRoleClients } = require('../common/role-users');
const { createUserWithProfile } = require('../clubs/list-fix');
const { expectHttpError } = require('../common/errors');
const { randomClubNumber, randomAddress } = require('../common/random');

/** O perfil nasce com o usuário (`POST /users` role=coordinator); depois recebe um clubinho. */
async function run({ http, logger, ctx }) {
  logger.section('coordinator-profiles/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  // `assign-club` recusa clubinho que já tem coordenador (é preciso mover);
  // o coordenador novo recebe um clubinho novo, criado só para ele.
  let club = null;
  await logger.check('POST /clubs sem coordenador para receber o coordenador novo', async () => {
    const res = await http.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'wednesday', time: '15:00', address: randomAddress() } });
    club = res.data;
    return `club #${club.number}`;
  });

  let created = null;
  await logger.check('POST /users role=coordinator cria o perfil de coordenador', async () => {
    created = await createUserWithProfile({ http, role: 'coordinator' });
    return `coordinatorProfileId=${created.profile.id} clubs=${created.profile.clubs?.length ?? 0}`;
  });

  if (created && club) {
    await logger.check(`PATCH /coordinator-profiles/:id/assign-club -> #${club.number}`, async () => {
      const res = await http.request('patch', `/coordinator-profiles/${created.profile.id}/assign-club`, { data: { clubId: club.id } });
      const detail = await http.request('get', `/coordinator-profiles/${created.profile.id}`);
      if (!detail.data?.clubs?.some((c) => c.id === club.id)) throw new Error('clubinho não refletiu no detalhe');
      return res.data?.message;
    });
    ctx.extraCoordinatorProfileId = created.profile.id;

    if (ctx.clubs?.[0]) {
      await logger.check('PATCH assign-club em clubinho que já tem coordenador responde 409', () =>
        expectHttpError(() => http.request('patch', `/coordinator-profiles/${created.profile.id}/assign-club`, { data: { clubId: ctx.clubs[0].id } }), 409, 'assign ocupado'),
      );
    }
    ctx.clubs = (await http.request('get', '/clubs/all')).data;
  }

  if (as.coordinator && created && club) {
    await logger.check('PATCH assign-club como coordenador responde 403', () =>
      expectHttpError(() => as.coordinator.request('patch', `/coordinator-profiles/${created.profile.id}/assign-club`, { data: { clubId: club.id } }), 403, 'coord assign'),
    );
  }

  await logger.check('PATCH assign-club com body sem clubId responde 400/422', () =>
    expectHttpError(() => http.request('patch', `/coordinator-profiles/${created?.profile.id ?? '00000000-0000-4000-8000-000000000000'}/assign-club`, { data: {} }), [400, 422], 'assign sem clubId'),
  );

  return { coordinatorProfileId: created?.profile.id ?? null };
}

module.exports = { run };
