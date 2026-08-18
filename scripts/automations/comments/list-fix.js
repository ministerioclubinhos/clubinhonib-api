async function run({ http, logger }) {
  logger.info('[comments/list-fix] listando comentários...');
  const res = await http.request('get', '/comments');
  const comments = Array.isArray(res.data) ? res.data : [];
  logger.info(`[comments/list-fix] OK total=${comments.length}`);

  // Publica todos os comentários não publicados (para popular o site)
  let published = 0;
  for (const c of comments) {
    if (!c?.id || c.published === true) continue;
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
      published++;
    } catch (e) {
      logger.warn(`[comments/list-fix] falhou publicar id=${c.id}: ${e.response?.data?.message || e.message}`);
    }
  }
  if (published > 0) {
    logger.info(`[comments/list-fix] publicados ${published} comentários`);
  }

  // Verifica os publicados
  const pub = await http.request('get', '/comments/published');
  const publishedList = Array.isArray(pub.data) ? pub.data : [];
  logger.info(`[comments/list-fix] OK publicados=${publishedList.length}`);

  return { comments, publishedCount: publishedList.length };
}

module.exports = { run };
