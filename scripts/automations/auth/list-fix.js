const { loginAs } = require('../common/http');
const { expectHttpError } = require('../common/errors');
const { ensureRoleClients } = require('../common/role-users');

/**
 * Sessão: `/auth/me`, `/auth/refresh`, `/auth/logout`, validação de token de
 * redefinição e o vínculo do professor ao clubinho por número.
 */
async function run({ http, logger, ctx }) {
  logger.section('auth/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  await logger.check('GET /auth/me devolve o perfil completo do superusuário', async () => {
    const res = await http.request('get', '/auth/me');
    for (const key of ['id', 'email', 'role', 'teacherProfile', 'coordinatorProfile']) {
      if (!(key in res.data)) throw new Error(`campo ausente no /auth/me: ${key}`);
    }
    return `role=${res.data.role}`;
  });

  for (const key of ['coordinator', 'teacher']) {
    if (!as[key]) continue;
    await logger.check(`GET /auth/me como ${key} traz o perfil do papel`, async () => {
      const res = await as[key].request('get', '/auth/me');
      const profile = key === 'teacher' ? res.data.teacherProfile : res.data.coordinatorProfile;
      if (!profile?.id) throw new Error(`${key}Profile ausente em /auth/me`);
      return `profileId=${profile.id}`;
    });
  }

  await logger.check('GET /auth/me sem token responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/auth/me'), 401, 'me anônimo'),
  );

  // Renovação e saída numa sessão separada, para não derrubar o token do superusuário.
  const cred = ctx.roleCredentials?.teacher;
  if (cred) {
    await logger.check('POST /auth/refresh renova o par de tokens', async () => {
      const session = await loginAs({ email: cred.email, password: cred.password, label: 'refresh' });
      const res = await session.request('post', '/auth/refresh', { data: { refreshToken: session.getRefreshToken() } });
      if (!res.data?.accessToken || !res.data?.refreshToken) throw new Error('refresh não devolveu tokens');
      await expectHttpError(
        () => session.request('post', '/auth/refresh', { data: { refreshToken: 'token-invalido' } }),
        401,
        'refresh inválido',
      );
      session.setToken(res.data.accessToken);
      const logout = await session.request('post', '/auth/logout');
      return `logout="${logout.data?.message}"`;
    });
  }

  await logger.check('GET /auth/reset-password/validate com token inválido responde 4xx', () =>
    expectHttpError(
      () => as.anonymous.request('get', '/auth/reset-password/validate', { params: { token: 'nao-existe' } }),
      [400, 401, 404, 422],
      'validate token',
    ),
  );

  await logger.check('POST /auth/forgot-password responde igual para qualquer e-mail', async () => {
    const res = await as.anonymous.request('post', '/auth/forgot-password', { data: { email: 'ninguem.automation@teste.clubinhonib.com' } });
    return `status="${res.data?.status}"`;
  }, { soft: true });

  // Professor sem clubinho se vincula sozinho pelo número. Uma rodada anterior
  // pode tê-lo vinculado; o admin desfaz o vínculo antes para o cenário ser
  // repetível, e o vínculo já existente é testado logo em seguida (400).
  if (as.teacherUnlinked && ctx.clubs?.length) {
    const club = ctx.clubs[0];
    await logger.check(`POST /auth/link-club vincula o professor ao clubinho #${club.number}`, async () => {
      const before = await as.teacherUnlinked.request('get', '/auth/me');
      const profile = before.data?.teacherProfile;
      if (profile?.club?.id) {
        await http.request('patch', `/teacher-profiles/${profile.id}/unassign-club`, { data: { clubId: profile.club.id } });
      }
      const res = await as.teacherUnlinked.request('post', '/auth/link-club', { data: { clubNumber: club.number } });
      const me = await as.teacherUnlinked.request('get', '/auth/me');
      if (me.data?.teacherProfile?.club?.id !== club.id) throw new Error('teacherProfile.club não reflete o vínculo');
      return res.data?.message;
    });
    await logger.check('POST /auth/link-club com professor já vinculado responde 400', () =>
      expectHttpError(() => as.teacherUnlinked.request('post', '/auth/link-club', { data: { clubNumber: club.number } }), [400, 409], 'link-club repetido'),
    );
    await logger.check('POST /auth/link-club com número inexistente responde 4xx', () =>
      expectHttpError(() => as.teacherUnlinked.request('post', '/auth/link-club', { data: { clubNumber: 999999 } }), [400, 404, 422], 'link-club inexistente'),
    );
  }

  return { ok: true };
}

module.exports = { run };
