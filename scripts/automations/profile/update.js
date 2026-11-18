const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { expectFields } = require('../common/update-helpers');
const { randomPhone } = require('../common/random');

/** `PATCH /profile` por papel: todos os campos próprios, parcial, e-mail duplicado, whitelist, 401. */
async function run({ http, logger, ctx }) {
  logger.section('profile/update');
  const as = await ensureRoleClients({ http, logger, ctx });

  for (const key of ['admin', 'coordinator', 'teacher', 'googleLike']) {
    const client = as[key];
    if (!client) continue;
    await logger.check(`PATCH /profile como ${key} edita nome, telefone e CPF e reflete em /auth/me`, async () => {
      const before = (await client.request('get', '/profile')).data;
      const body = { name: `${before.name.split(' (')[0]} (editado)`, phone: randomPhone(), cpf: String(Math.floor(10000000000 + Math.random() * 89999999999)) };
      const res = await client.request('patch', '/profile', { data: body });
      expectFields(res.data, body, 'PATCH /profile');
      const me = (await client.request('get', '/auth/me')).data;
      expectFields(me, body, '/auth/me');
      await client.request('patch', '/profile', { data: { name: before.name } });
      return `phone=${body.phone}`;
    });
  }

  if (as.teacher) {
    await logger.check('PATCH /profile parcial (só phone) mantém nome e e-mail', async () => {
      const before = (await as.teacher.request('get', '/profile')).data;
      const res = await as.teacher.request('patch', '/profile', { data: { phone: '31977776666' } });
      expectFields(res.data, { phone: '31977776666', name: before.name, email: before.email }, 'parcial');
      return 'ok';
    });
    await logger.check('PATCH /profile com e-mail de outro usuário responde 409', () =>
      expectHttpError(() => as.teacher.request('patch', '/profile', { data: { email: ctx.roleCredentials?.coordinator?.email ?? 'superuser@clubinhonib.com' } }), 409, 'profile email dup'),
    );
    await logger.check('PATCH /profile com nome de 1 letra responde 400/422', () =>
      expectHttpError(() => as.teacher.request('patch', '/profile', { data: { name: 'A' } }), [400, 422], 'profile name'),
    );
    await logger.check('PATCH /profile com active/role no corpo responde 400/422 (whitelist)', () =>
      expectHttpError(() => as.teacher.request('patch', '/profile', { data: { active: false } }), [400, 422], 'profile whitelist'),
    );
  }
  await logger.check('PATCH /profile anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('patch', '/profile', { data: { name: 'X' } }), 401, 'profile anônimo'),
  );
  return { ok: true };
}

module.exports = { run };
