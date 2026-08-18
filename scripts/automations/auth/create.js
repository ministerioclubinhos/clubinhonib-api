const { SUPERUSER_EMAIL, SUPERUSER_PASSWORD } = require('../common/config');

async function run({ http, logger }) {
  logger.info('[auth/create] verificando superusuário e testando login...');

  // Testa o login do superusuário
  try {
    const token = await http.login(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);
    if (!token) throw new Error('Token não retornado');
    logger.info(`[auth/create] OK login superusuário: ${SUPERUSER_EMAIL}`);
  } catch (e) {
    logger.warn(`[auth/create] falha no login: ${e.message}`);
    throw e;
  }

  return { ok: true, email: SUPERUSER_EMAIL };
}

module.exports = { run };
