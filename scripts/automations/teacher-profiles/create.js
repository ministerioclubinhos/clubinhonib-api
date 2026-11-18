const { ensureRoleClients } = require('../common/role-users');
const { createUserWithProfile } = require('../clubs/list-fix');
const { expectHttpError } = require('../common/errors');

/**
 * O perfil de professor nasce com o usuário (`POST /users` role=teacher).
 * Aqui: cria um professor, confere o perfil e o vincula a um clubinho.
 */
async function run({ http, logger, ctx }) {
  logger.section('teacher-profiles/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const club = ctx.clubs?.[0];

  let created = null;
  await logger.check('POST /users role=teacher cria o perfil de professor', async () => {
    created = await createUserWithProfile({ http, role: 'teacher' });
    if (created.profile.club) throw new Error('professor novo já nasceu com clubinho');
    return `teacherProfileId=${created.profile.id}`;
  });

  if (created && club) {
    await logger.check(`PATCH /teacher-profiles/:id/assign-club -> #${club.number}`, async () => {
      const res = await http.request('patch', `/teacher-profiles/${created.profile.id}/assign-club`, { data: { clubId: club.id } });
      const detail = await http.request('get', `/teacher-profiles/${created.profile.id}`);
      if (detail.data?.club?.id !== club.id) throw new Error('club não refletiu no detalhe');
      return res.data?.message;
    });
    ctx.extraTeacherProfileId = created.profile.id;
  }

  await logger.check('PATCH assign-club com clubId inexistente responde 404', () =>
    expectHttpError(
      () => http.request('patch', `/teacher-profiles/${created?.profile.id ?? '00000000-0000-4000-8000-000000000000'}/assign-club`, { data: { clubId: '00000000-0000-4000-8000-000000000000' } }),
      [404, 400],
      'assign inexistente',
    ),
  );

  if (as.teacher && created) {
    await logger.check('PATCH assign-club como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('patch', `/teacher-profiles/${created.profile.id}/assign-club`, { data: { clubId: club?.id } }), 403, 'assign teacher'),
    );
  }

  return { teacherProfileId: created?.profile.id ?? null };
}

module.exports = { run };
