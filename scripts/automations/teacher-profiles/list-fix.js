const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[teacher-profiles/list-fix] listando perfis de professores...');
  const teachers = await fetchAllPages(http.request, 'get', '/teacher-profiles', {}, { limit: 100, maxPages: 200 });

  let withClub = 0;
  let withoutClub = 0;
  let inactive = 0;

  for (const t of teachers) {
    if (t?.club?.id) withClub++;
    else withoutClub++;
    if (!t?.active) inactive++;
  }

  logger.info(
    `[teacher-profiles/list-fix] OK total=${teachers.length} comClube=${withClub} semClube=${withoutClub} inativos=${inactive}`,
  );
  return { teachers, withClub, withoutClub, inactive };
}

module.exports = { run };
