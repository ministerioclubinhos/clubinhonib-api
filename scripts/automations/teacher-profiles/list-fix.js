const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[teacher-profiles/list-fix] listing teacher-profiles (all pages)...');
  const teachers = await fetchAllPages(http.request, 'get', '/teacher-profiles', {}, { limit: 100, maxPages: 200 });

  
  
  let withoutClub = 0;
  for (const t of teachers) {
    if (!t?.club?.id) withoutClub++;
  }

  logger.info(`[teacher-profiles/list-fix] OK total=${teachers.length} withoutClub=${withoutClub}`);
  return { teachers, withoutClub };
}

module.exports = { run };


