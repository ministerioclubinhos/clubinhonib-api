const { fetchAllPages } = require('../common/pagination');
const { randomJoinedAt } = require('../common/random');

async function run({ http, logger }) {
  logger.info('[children/list-fix] listando children (todas as páginas) e corrigindo joinedAt ausente...');
  const children = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100 });

  let fixed = 0;
  for (const child of children) {
    if (!child?.id) continue;
    if (child.joinedAt && child.joinedAt !== 'null') continue;

    try {
      await http.request('put', `/children/${child.id}`, {
        data: { joinedAt: randomJoinedAt() },
      });
      fixed++;
    } catch (e) {
      logger.warn(`[children/list-fix] falhou update child=${child.id}: ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[children/list-fix] OK total=${children.length} fixedJoinedAt=${fixed}`);
  return { children, fixedJoinedAt: fixed };
}

module.exports = { run };


