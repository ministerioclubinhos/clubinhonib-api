const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[users/list-fix] listando usuários (todas as páginas)...');
  const users = await fetchAllPages(http.request, 'get', '/users', {}, { limit: 100 });
  logger.info(`[users/list-fix] OK total=${users.length}`);
  
  return { users };
}

module.exports = { run };


