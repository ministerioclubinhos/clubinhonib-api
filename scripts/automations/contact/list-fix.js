async function run({ http, logger }) {
  logger.info('[contact/list-fix] listando contatos...');
  const res = await http.request('get', '/contact');
  const contacts = Array.isArray(res.data) ? res.data : [];
  logger.info(`[contact/list-fix] OK total=${contacts.length}`);

  // Fix: marcar como lidos os não lidos
  let marked = 0;
  for (const c of contacts) {
    if (!c?.id) continue;
    if (c.read === true) continue;
    try {
      await http.request('patch', `/contact/${c.id}/read`);
      marked++;
    } catch (e) {
      logger.warn(`[contact/list-fix] falhou marcar read id=${c.id}: ${e.response?.data?.message || e.message}`);
    }
  }
  logger.info(`[contact/list-fix] markedRead=${marked}`);
  return { contacts, markedRead: marked };
}

module.exports = { run };
