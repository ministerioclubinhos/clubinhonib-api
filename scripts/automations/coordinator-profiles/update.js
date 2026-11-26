const { randomClubNumber, randomAddress } = require('../common/random');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { runEditContractChecks } = require('../common/update-helpers');
const { createUserWithProfile } = require('../clubs/list-fix');

/** `assign-club`, `unassign-club` e `move-club` de coordenadores: fluxo completo, erros e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('coordinator-profiles/update');
  const as = await ensureRoleClients({ http, logger, ctx });

  const club = (await http.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'wednesday', address: randomAddress() } })).data;
  const { profile: coordA } = await createUserWithProfile({ http, role: 'coordinator' });
  const { profile: coordB } = await createUserWithProfile({ http, role: 'coordinator' });
  const assign = (client, id, body) => client.request('patch', `/coordinator-profiles/${id}/assign-club`, { data: body });
  assign.sampleId = coordA.id;

  await logger.check('assign-club vincula e by-club devolve o coordenador', async () => {
    await assign(http, coordA.id, { clubId: club.id });
    const byClub = (await http.request('get', `/coordinator-profiles/by-club/${club.id}`)).data;
    if (byClub.id !== coordA.id) throw new Error('by-club divergente');
    return 'ok';
  });
  await logger.check('assign-club em clubinho já coordenado por outro responde 409', () =>
    expectHttpError(() => assign(http, coordB.id, { clubId: club.id }), 409, 'ocupado'),
  );
  await logger.check('move-club transfere para o outro coordenador', async () => {
    await http.request('patch', `/coordinator-profiles/${coordA.id}/move-club`, { data: { clubId: club.id, toCoordinatorProfileId: coordB.id } });
    const detail = (await http.request('get', `/clubs/${club.id}`)).data;
    if (detail.coordinator?.id !== coordB.id) throw new Error('não transferiu');
    return 'ok';
  });
  await logger.check('move-club de quem não coordena o clubinho responde 4xx', () =>
    expectHttpError(() => http.request('patch', `/coordinator-profiles/${coordA.id}/move-club`, { data: { clubId: club.id, toCoordinatorProfileId: coordA.id } }), [400, 403, 404, 409], 'move errado'),
  );
  await logger.check('unassign-club solta o clubinho', async () => {
    await http.request('patch', `/coordinator-profiles/${coordB.id}/unassign-club`, { data: { clubId: club.id } });
    const detail = (await http.request('get', `/clubs/${club.id}`)).data;
    if (detail.coordinator) throw new Error('ainda coordenado');
    return 'ok';
  });
  await logger.check('unassign-club de clubinho não coordenado responde 4xx', () =>
    expectHttpError(() => http.request('patch', `/coordinator-profiles/${coordB.id}/unassign-club`, { data: { clubId: club.id } }), [400, 404, 409, 422], 'unassign errado'),
  );
  await runEditContractChecks({ logger, as, http, label: 'PATCH /coordinator-profiles/:id/assign-club', edit: assign, validBody: { clubId: club.id }, invalidBodies: [{}, { clubId: 'x' }], forbiddenRoles: ['coordinator', 'teacher'] });
  await logger.check('move-club com toCoordinatorProfileId inválido responde 400/422', () =>
    expectHttpError(() => http.request('patch', `/coordinator-profiles/${coordA.id}/move-club`, { data: { clubId: club.id, toCoordinatorProfileId: 'x' } }), [400, 422], 'move dto'),
  );

  await http.request('delete', `/clubs/${club.id}`);
  return { ok: true };
}

module.exports = { run };
