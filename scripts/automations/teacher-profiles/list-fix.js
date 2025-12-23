const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[teacher-profiles/list-fix] listando teacher-profiles (todas as páginas)...');
  const teachers = await fetchAllPages(http.request, 'get', '/teacher-profiles', {}, { limit: 100, maxPages: 200 });

  // Inconsistência comum: teacher.active=false enquanto user.active=true, ou teacher sem club.
  // Por enquanto, só reporta (o "fix" forte é feito via clubs/list-fix que garante mínimo por clube).
  let withoutClub = 0;
  for (const t of teachers) {
    if (!t?.club?.id) withoutClub++;
  }

  logger.info(`[teacher-profiles/list-fix] OK total=${teachers.length} withoutClub=${withoutClub}`);
  return { teachers, withoutClub };
}

module.exports = { run };


