const { randomName, randomEmail, randomPhone } = require('../common/random');

async function run({ http, logger }) {
  // "create" aqui significa validar o fluxo de registro (cria usuário novo pelo /auth/register)
  const dto = {
    name: randomName(),
    email: randomEmail('register'),
    phone: randomPhone(),
    password: 'Senha123@',
    role: 'teacher',
  };

  logger.info(`[auth/create] registrando usuário via /auth/register (${dto.email})...`);
  try {
    const res = await http.request('post', '/auth/register', { data: dto });
    logger.info(`[auth/create] OK register status=200/201 id=${res.data?.id ?? 'n/a'}`);
  } catch (e) {
    logger.warn(`[auth/create] falhou register: ${e.response?.data?.message || e.message}`);
  }

  return { ok: true };
}

module.exports = { run };


