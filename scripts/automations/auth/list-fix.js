async function run({ http, logger }) {
  
  logger.info('[auth/list-fix] validating /auth/me ...');
  const me = await http.request('get', '/auth/me');
  logger.info(`[auth/list-fix] OK me.userId=${me.data?.id ?? me.data?.userId ?? 'n/a'}`);

  
  try {
    await http.request('post', '/auth/logout');
    logger.info('[auth/list-fix] OK logout');
  } catch (e) {
    logger.warn(`[auth/list-fix] logout failed (ok in some environments): ${e.response?.data?.message || e.message}`);
  }

  return { ok: true };
}

module.exports = { run };


