async function run({ http, logger }) {
  // "list-fix" aqui significa validar endpoints de sessão (me/logout)
  logger.info('[auth/list-fix] validando /auth/me ...');
  const me = await http.request('get', '/auth/me');
  logger.info(`[auth/list-fix] OK me.userId=${me.data?.id ?? me.data?.userId ?? 'n/a'}`);

  // logout (não quebra se falhar)
  try {
    await http.request('post', '/auth/logout');
    logger.info('[auth/list-fix] OK logout');
  } catch (e) {
    logger.warn(`[auth/list-fix] logout falhou (ok em alguns ambientes): ${e.response?.data?.message || e.message}`);
  }

  return { ok: true };
}

module.exports = { run };


