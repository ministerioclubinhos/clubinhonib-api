async function run({ http, logger }) {
  logger.info('[comments/list-fix] listando comentários...');
  const res = await http.request('get', '/comments');
  const comments = Array.isArray(res.data) ? res.data : [];
  logger.info(`[comments/list-fix] OK total=${comments.length}`);

  // Fix: garantir pelo menos 1 comentário publicado (se existir)
  for (const c of comments) {
    if (!c?.id) continue;
    if (c.published === true) break;
    try {
      await http.request('put', `/comments/${c.id}`, {
        data: {
          name: c.name,
          comment: c.comment,
          clubinho: c.clubinho,
          neighborhood: c.neighborhood,
          published: true,
        },
      });
      logger.info(`[comments/list-fix] published comment id=${c.id}`);
      break;
    } catch (e) {
      logger.warn(`[comments/list-fix] falhou publish id=${c.id}: ${e.response?.data?.message || e.message}`);
    }
  }

  // Smoke: endpoint público
  const pub = await http.request('get', '/comments/published');
  const published = Array.isArray(pub.data) ? pub.data : [];
  logger.info(`[comments/list-fix] OK published=${published.length}`);

  return { comments, published };
}

module.exports = { run };
