const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { loginAs } = require('../common/http');
const { DEFAULT_PASSWORD } = require('../common/config');
const { randomPhone } = require('../common/random');

/**
 * `GET /profile`, `PATCH /profile` e `PATCH /profile/password` para cada
 * papel. A senha volta ao padrão no fim para a próxima rodada logar.
 */
async function run({ http, logger, ctx }) {
  logger.section('profile/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  for (const key of ['admin', 'coordinator', 'teacher', 'coordinatorNoClubs', 'teacherUnlinked', 'googleLike']) {
    const client = as[key];
    if (!client) continue;
    await logger.check(`GET /profile como ${key} bate com /auth/me`, async () => {
      const [profile, me] = await Promise.all([client.request('get', '/profile'), client.request('get', '/auth/me')]);
      if (profile.data.id !== me.data.id) throw new Error('ids diferentes entre /profile e /auth/me');
      for (const field of ['email', 'name', 'role', 'active', 'completed', 'commonUser', 'image', 'teacherProfile', 'coordinatorProfile']) {
        if (!(field in profile.data)) throw new Error(`campo ausente: ${field}`);
      }
      return `${profile.data.role} image=${profile.data.image ? 'sim' : 'não'}`;
    });
  }

  if (as.teacher) {
    await logger.check('PATCH /profile atualiza nome e telefone do próprio usuário', async () => {
      const phone = randomPhone();
      const res = await as.teacher.request('patch', '/profile', { data: { name: 'Professor Automação', phone } });
      if (res.data.phone !== phone) throw new Error('telefone não atualizado');
      return `phone=${phone}`;
    });

    await logger.check('PATCH /profile com role no corpo responde 400/422 (whitelist)', () =>
      expectHttpError(() => as.teacher.request('patch', '/profile', { data: { role: 'admin' } }), [400, 422], 'profile role'),
    );
  }

  // Troca de senha: commonUser exige a senha atual; conta "Google" não.
  const cred = ctx.roleCredentials?.teacher;
  if (cred) {
    await logger.check('PATCH /profile/password (commonUser) exige senha atual e troca de fato', async () => {
      const session = await loginAs({ email: cred.email, password: cred.password, label: 'pwd' });
      await expectHttpError(
        () => session.request('patch', '/profile/password', { data: { newPassword: 'NovaSenha123@' } }),
        [400, 401, 422],
        'sem currentPassword',
      );
      await expectHttpError(
        () => session.request('patch', '/profile/password', { data: { currentPassword: 'errada', newPassword: 'NovaSenha123@' } }),
        [400, 401],
        'currentPassword errada',
      );
      await session.request('patch', '/profile/password', { data: { currentPassword: cred.password, newPassword: 'NovaSenha123@' } });
      const relogin = await loginAs({ email: cred.email, password: 'NovaSenha123@', label: 'pwd2' });
      await relogin.request('patch', '/profile/password', { data: { currentPassword: 'NovaSenha123@', newPassword: DEFAULT_PASSWORD } });
      return 'senha trocada e restaurada';
    });
  }

  const google = ctx.roleCredentials?.googleLike;
  if (google && as.googleLike) {
    await logger.check('PATCH /profile/password (conta Google) troca sem senha atual', async () => {
      await as.googleLike.request('patch', '/profile/password', { data: { newPassword: 'NovaSenha123@' } });
      const relogin = await loginAs({ email: google.email, password: 'NovaSenha123@', label: 'google2' });
      await relogin.request('patch', '/profile/password', { data: { newPassword: DEFAULT_PASSWORD } });
      return 'ok';
    });
  }

  await logger.check('GET /profile anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/profile'), 401, 'profile anônimo'),
  );

  return { ok: true };
}

module.exports = { run };
