const { randomName, randomEmail, randomPhone } = require('../common/random');

async function createUsers({ http, logger, count = 20 }) {
  const created = [];

  // Garante proporção realista de roles
  const roleDistribution = [];
  const teacherCount = Math.floor(count * 0.6);   // 60% professores
  const coordCount = Math.floor(count * 0.3);      // 30% coordenadores
  const adminCount = count - teacherCount - coordCount; // 10% admins

  for (let i = 0; i < teacherCount; i++) roleDistribution.push('teacher');
  for (let i = 0; i < coordCount; i++) roleDistribution.push('coordinator');
  for (let i = 0; i < adminCount; i++) roleDistribution.push('admin');

  // Embaralha
  for (let i = roleDistribution.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roleDistribution[i], roleDistribution[j]] = [roleDistribution[j], roleDistribution[i]];
  }

  for (let i = 0; i < count; i++) {
    const role = roleDistribution[i] || 'teacher';
    const dto = {
      name: randomName(),
      email: randomEmail(role),
      password: 'Senha123@',
      phone: randomPhone(),
      role,
      active: true,
      completed: true,
      commonUser: role === 'admin' ? false : Math.random() > 0.7,
    };
    try {
      const res = await http.request('post', '/users', { data: dto });
      created.push(res.data);
      logger.info(`[users/create] +1 ${role}: ${dto.name} (${dto.email})`);
    } catch (e) {
      logger.warn(`[users/create] falhou ${dto.email}: ${e.response?.data?.message || e.message}`);
    }
  }

  return created;
}

async function run({ http, logger, ctx }) {
  const count = ctx?.usersToCreate ?? 20;
  logger.info(`[users/create] criando ${count} usuários (60% professores, 30% coordenadores, 10% admins)...`);
  const users = await createUsers({ http, logger, count });
  logger.info(`[users/create] OK criados=${users.length}`);
  return { users };
}

module.exports = { run, createUsers };
