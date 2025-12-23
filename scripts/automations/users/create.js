const { randomName, randomEmail, randomPhone } = require('../common/random');

async function createUsers({ http, logger, count = 20 }) {
  const created = [];
  const roles = ['teacher', 'coordinator', 'admin'];

  for (let i = 0; i < count; i++) {
    const role = roles[Math.floor(Math.random() * roles.length)];
    const dto = {
      name: randomName(),
      email: randomEmail(role),
      password: 'Senha123@',
      phone: randomPhone(),
      role,
      active: true,
      completed: true,
      commonUser: Math.random() > 0.5,
    };
    try {
      const res = await http.request('post', '/users', { data: dto });
      created.push(res.data);
      logger.info(`[users/create] +1 ${role} ${dto.email}`);
    } catch (e) {
      logger.warn(`[users/create] falhou ${dto.email}: ${e.response?.data?.message || e.message}`);
    }
  }

  return created;
}

async function run({ http, logger, ctx }) {
  const count = ctx?.usersToCreate ?? 20;
  logger.info(`[users/create] criando ${count} usuários...`);
  const users = await createUsers({ http, logger, count });
  logger.info(`[users/create] OK criados=${users.length}`);
  return { users };
}

module.exports = { run, createUsers };


