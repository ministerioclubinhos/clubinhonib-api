const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[users/list-fix] listing users (all pages)...');
  const users = await fetchAllPages(http.request, 'get', '/users', {}, { limit: 100 });
  logger.info(`[users/list-fix] OK total=${users.length}`);
  
  return { users };
}

module.exports = { run };


