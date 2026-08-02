async function run({ http, logger }) {
  // Verifica que o token atual funciona consultando /auth/me
  logger.info('[auth/list-fix] validando token via /auth/me...');
  try {
    const me = await http.request('get', '/auth/me');
    logger.info(`[auth/list-fix] OK usuário autenticado: id=${me.data?.id ?? me.data?.userId ?? 'n/a'}`);
  } catch (e) {
    logger.warn(`[auth/list-fix] /auth/me falhou: ${e.response?.data?.message || e.message}`);
  }

  // NÃO faz logout aqui para não quebrar o token dos steps seguintes
  return { ok: true };
}

module.exports = { run };
