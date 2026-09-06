const { randomClubNumber, randomAddress } = require('../common/random');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { runEditContractChecks } = require('../common/update-helpers');
const { createUserWithProfile } = require('../clubs/list-fix');

/** `PATCH /teacher-profiles/:id/assign-club` e `/unassign-club`: vincular, mover, desvincular, erros e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('teacher-profiles/update');
  const as = await ensureRoleClients({ http, logger, ctx });

  const clubA = (await http.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'tuesday', address: randomAddress() } })).data;
  const clubB = (await http.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'thursday', address: randomAddress() } })).data;
  const { profile } = await createUserWithProfile({ http, role: 'teacher' });
  const assign = (client, id, body) => client.request('patch', `/teacher-profiles/${id}/assign-club`, { data: body });
  assign.sampleId = profile.id;

  await logger.check('assign-club vincula e o detalhe/by-club refletem', async () => {
    await assign(http, profile.id, { clubId: clubA.id });
    const detail = (await http.request('get', `/teacher-profiles/${profile.id}`)).data;
    if (detail.club?.id !== clubA.id) throw new Error('club não aplicado');
    const byClub = (await http.request('get', `/teacher-profiles/by-club/${clubA.id}`)).data;
    if (!byClub.some((t) => t.id === profile.id)) throw new Error('não apareceu em by-club');
    return `#${clubA.number}`;
  });
  await logger.check('assign-club para outro clubinho move (sai do anterior)', async () => {
    await assign(http, profile.id, { clubId: clubB.id });
    const [a, b] = await Promise.all([http.request('get', `/clubs/${clubA.id}`), http.request('get', `/clubs/${clubB.id}`)]);
    if (a.data.teachers.some((t) => t.id === profile.id)) throw new Error('ainda no clubinho anterior');
    if (!b.data.teachers.some((t) => t.id === profile.id)) throw new Error('não chegou ao novo');
    return `#${clubA.number} -> #${clubB.number}`;
  });
  await logger.check('assign-club repetido no mesmo clubinho é idempotente', async () => {
    await assign(http, profile.id, { clubId: clubB.id });
    const detail = (await http.request('get', `/teacher-profiles/${profile.id}`)).data;
    if (detail.club?.id !== clubB.id) throw new Error('vínculo perdido');
    return 'ok';
  });
  await logger.check('unassign-club com clubId errado responde 4xx e com o certo desvincula', async () => {
    await expectHttpError(() => http.request('patch', `/teacher-profiles/${profile.id}/unassign-club`, { data: { clubId: clubA.id } }), [400, 404, 409, 422], 'unassign errado');
    await http.request('patch', `/teacher-profiles/${profile.id}/unassign-club`, { data: { clubId: clubB.id } });
    const detail = (await http.request('get', `/teacher-profiles/${profile.id}`)).data;
    if (detail.club) throw new Error('ainda vinculado');
    return 'ok';
  });
  await logger.check('unassign-club sem clubId desvincula de onde estiver', async () => {
    await assign(http, profile.id, { clubId: clubA.id });
    await http.request('patch', `/teacher-profiles/${profile.id}/unassign-club`, { data: {} });
    const detail = (await http.request('get', `/teacher-profiles/${profile.id}`)).data;
    if (detail.club) throw new Error('ainda vinculado');
    return 'ok';
  });
  await runEditContractChecks({ logger, as, http, label: 'PATCH /teacher-profiles/:id/assign-club', edit: assign, validBody: { clubId: clubA.id }, invalidBodies: [{}, { clubId: 'x' }, { clubId: clubA.id, extra: 1 }], forbiddenRoles: ['teacher'] });
  await logger.check('assign-club com clubId inexistente responde 404', () =>
    expectHttpError(() => assign(http, profile.id, { clubId: '00000000-0000-4000-8000-000000000000' }), [400, 404], 'club inexistente'),
  );

  await http.request('delete', `/clubs/${clubA.id}`);
  await http.request('delete', `/clubs/${clubB.id}`);
  return { ok: true };
}

module.exports = { run };
