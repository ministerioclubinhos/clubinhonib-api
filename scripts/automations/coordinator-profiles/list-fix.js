const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[coordinator-profiles/list-fix] listando perfis de coordenadores...');
  const coords = await fetchAllPages(http.request, 'get', '/coordinator-profiles', {}, { limit: 100, maxPages: 200 });

  let withClubs = 0;
  let withoutClubs = 0;
  let totalClubsMapped = 0;

  for (const c of coords) {
    const clubs = Array.isArray(c?.clubs) ? c.clubs : [];
    if (clubs.length > 0) {
      withClubs++;
      totalClubsMapped += clubs.length;
    } else {
      withoutClubs++;
    }
  }

  logger.info(
    `[coordinator-profiles/list-fix] OK total=${coords.length} comClubes=${withClubs} semClubes=${withoutClubs} totalClubesMapeados=${totalClubsMapped}`,
  );
  return { coordinators: coords, withClubs, withoutClubs };
}

module.exports = { run };
