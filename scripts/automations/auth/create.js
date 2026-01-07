const { randomName, randomEmail, randomPhone } = require('../common/random');

async function run({ http, logger }) {
  
  const dto = {
    name: randomName(),
    email: randomEmail('register'),
    phone: randomPhone(),
    password: 'Senha123@',
    role: 'teacher',
  };

  logger.info(`[auth/create] registering user via /auth/register (${dto.email})...`);
  try {
    const res = await http.request('post', '/auth/register', { data: dto });
    logger.info(`[auth/create] OK register status=200/201 id=${res.data?.id ?? 'n/a'}`);
  } catch (e) {
    logger.warn(`[auth/create] register failed: ${e.response?.data?.message || e.message}`);
  }

  return { ok: true };
}

module.exports = { run };


