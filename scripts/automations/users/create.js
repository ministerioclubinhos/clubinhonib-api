const { randomName, randomEmail, randomPhone, randomCpf, pick } = require('../common/random');
const { DEFAULT_PASSWORD } = require('../common/config');
const { ensureRoleUsers, loginRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/**
 * Usuários de todos os papéis.
 *
 * Primeiro os fixos (um por cenário: admin, coordenador com e sem clubinho,
 * professor com e sem clubinho, professor inativo, conta "Google" sem senha),
 * depois um lote aleatório para dar volume às listagens. `POST /users` cria o
 * perfil de professor/coordenador junto com a conta.
 */
async function createRandomUsers({ http, logger, count }) {
  const created = [];
  const roles = ['teacher', 'teacher', 'teacher', 'coordinator', 'admin'];
  for (let i = 0; i < count; i++) {
    const role = pick(roles);
    const dto = {
      name: randomName(),
      email: randomEmail(role),
      password: DEFAULT_PASSWORD,
      phone: randomPhone(),
      role,
      active: Math.random() > 0.1,
      completed: true,
      commonUser: Math.random() > 0.3,
      ...(Math.random() > 0.5 ? { cpf: randomCpf() } : {}),
    };
    try {
      const res = await http.request('post', '/users', { data: dto });
      if (res.data?.password) throw new Error('resposta expôs o campo password');
      created.push(res.data);
    } catch (e) {
      logger.warn(`[users/create] falhou ${dto.email}: ${require('../common/errors').errorMessage(e)}`);
    }
  }
  return created;
}

async function run({ http, logger, ctx }) {
  logger.section('users/create');

  const { users, credentials } = await ensureRoleUsers({ http, logger });
  ctx.roleUsers = users;
  ctx.roleCredentials = credentials;
  ctx.as = await loginRoleClients({ credentials, logger, baseHttp: http });
  ctx.as.superuser = http;
  logger.ok(`usuários fixos garantidos: ${Object.keys(users).join(', ')} | sessões: ${Object.keys(ctx.as).join(', ')}`);

  const count = ctx?.usersToCreate ?? 12;
  const random = await createRandomUsers({ http, logger, count });
  logger.ok(`[users/create] lote aleatório criado=${random.length}/${count}`);
  ctx.randomUsers = random;

  await logger.check('POST /users com e-mail já usado responde 409', () =>
    expectHttpError(
      () => http.request('post', '/users', { data: { name: 'Dup', email: credentials.teacher.email, password: DEFAULT_PASSWORD, phone: randomPhone(), role: 'teacher' } }),
      409,
      'users duplicado',
    ),
  );

  await logger.check('POST /users com campo desconhecido responde 400/422 (whitelist)', () =>
    expectHttpError(
      () => http.request('post', '/users', { data: { name: 'X', email: randomEmail('bad'), password: DEFAULT_PASSWORD, phone: '1', role: 'teacher', hacker: true } }),
      [400, 422],
      'users whitelist',
    ),
  );

  if (ctx.as.coordinator) {
    await logger.check('POST /users como coordenador responde 403', () =>
      expectHttpError(
        () => ctx.as.coordinator.request('post', '/users', { data: { name: 'X', email: randomEmail('coord'), password: DEFAULT_PASSWORD, phone: '1', role: 'teacher' } }),
        403,
        'users coordenador',
      ),
    );
  }

  return { users, random };
}

module.exports = { run, createRandomUsers };
