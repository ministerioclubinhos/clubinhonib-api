async function run({ http, logger }) {
  logger.info('[site-feedbacks/list-fix] listing feedbacks...');
  const res = await http.request('get', '/site-feedbacks');
  const items = Array.isArray(res.data) ? res.data : [];
  logger.info(`[site-feedbacks/list-fix] OK total=${items.length}`);

  let marked = 0;
  for (const fb of items) {
    if (!fb?.id) continue;
    if (fb.read === true) continue;
    try {
      await http.request('patch', `/site-feedbacks/${fb.id}/read`);
      marked++;
    } catch (e) {
      logger.warn(`[site-feedbacks/list-fix] failed to mark as read id=${fb.id}: ${e.response?.data?.message || e.message}`);
    }
  }
  logger.info(`[site-feedbacks/list-fix] markedRead=${marked}`);
  return { feedbacks: items, markedRead: marked };
}

module.exports = { run };
