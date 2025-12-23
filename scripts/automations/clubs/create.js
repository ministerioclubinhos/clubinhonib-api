const { randomClubNumber, randomWeekday, randomTime, randomAddress } = require('../common/random');

async function createClubs({ http, logger, count = 5 }) {
  const created = [];
  for (let i = 0; i < count; i++) {
    const dto = {
      number: randomClubNumber(),
      weekday: randomWeekday(),
      time: Math.random() > 0.2 ? randomTime() : undefined,
      isActive: true,
      address: randomAddress(),
    };
    try {
      const res = await http.request('post', '/clubs', { data: dto });
      created.push(res.data);
      logger.info(`[clubs/create] +1 club #${dto.number}`);
    } catch (e) {
      logger.warn(`[clubs/create] falhou #${dto.number}: ${e.response?.data?.message || e.message}`);
    }
  }
  return created;
}

async function run({ http, logger, ctx }) {
  const minClubs = ctx?.minClubs ?? 10;
  logger.info(`[clubs/create] garantindo pelo menos ${minClubs} clubes...`);

  const existing = await http.request('get', '/clubs/all');
  const clubs = Array.isArray(existing.data) ? existing.data : [];
  if (clubs.length >= minClubs) {
    logger.info(`[clubs/create] OK já existem ${clubs.length} clubes`);
    return { clubs, created: [] };
  }

  const toCreate = minClubs - clubs.length;
  const created = await createClubs({ http, logger, count: toCreate });
  const updated = await http.request('get', '/clubs/all');
  const final = Array.isArray(updated.data) ? updated.data : [];
  logger.info(`[clubs/create] OK total=${final.length} (criados=${created.length})`);
  return { clubs: final, created };
}

module.exports = { run, createClubs };


