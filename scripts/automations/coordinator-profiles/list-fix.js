const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[coordinator-profiles/list-fix] listing coordinator-profiles (all pages)...');
  const coords = await fetchAllPages(http.request, 'get', '/coordinator-profiles', {}, { limit: 100, maxPages: 200 });

  let empty = 0;
  for (const c of coords) {
    const clubs = Array.isArray(c?.clubs) ? c.clubs : [];
    if (clubs.length === 0) empty++;
  }

  logger.info(`[coordinator-profiles/list-fix] OK total=${coords.length} withZeroClubs=${empty}`);
  return { coordinators: coords, withZeroClubs: empty };
}

module.exports = { run };


