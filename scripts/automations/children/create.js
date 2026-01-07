const { fetchAllPages } = require('../common/pagination');
const { randomName, randomBirthDate, randomGender, randomPhone, randomJoinedAt, randomAddress } = require('../common/random');

async function createChildrenForClubs({ http, logger, clubs, countPerClub = 10 }) {
  const created = [];

  for (const club of clubs) {
    for (let i = 0; i < countPerClub; i++) {
      const dto = {
        name: randomName(),
        birthDate: randomBirthDate(),
        guardianName: randomName(),
        gender: randomGender(),
        guardianPhone: randomPhone(),
        joinedAt: randomJoinedAt(),
        isActive: Math.random() > 0.2,
        clubId: club.id,
        address: Math.random() > 0.3 ? randomAddressnode run-all-testes.js
() : undefined,
      };
      try {
        const res = await http.request('post', '/children', { data: dto });
        created.push(res.data);
      } catch (e) {
        logger.warn(`[children/create] falhou club #${club.number}: ${e.response?.data?.message || e.message}`);
      }
    }
    logger.info(`[children/create] club #${club.number} +${countPerClub} children`);
  }

  return created;
}

async function run({ http, logger, ctx }) {
  const clubsRes = await http.request('get', '/clubs/all');
  const clubs = Array.isArray(clubsRes.data) ? clubsRes.data : [];

  const countPerClub = ctx?.childrenPerClub ?? 10;
  logger.info(`[children/create] criando ${countPerClub} crianças por club (clubs=${clubs.length})...`);
  const children = await createChildrenForClubs({ http, logger, clubs, countPerClub });
  logger.info(`[children/create] OK criadas=${children.length}`);
  return { children };
}

module.exports = { run, createChildrenForClubs };


