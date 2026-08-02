const { randomChildName, randomPhone, randomBirthDate, randomJoinedAt, randomAddress } = require('../common/random');
const { ACADEMIC_YEAR } = require('../common/config');

async function createChildrenForClub({ http, logger, clubId, clubNumber, count = 10, academicYear = ACADEMIC_YEAR }) {
  const created = [];
  for (let i = 0; i < count; i++) {
    const { name } = randomChildName();
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const dto = {
      name,
      guardianName: `${Math.random() > 0.5 ? 'Pai' : 'Mãe'} de ${name.split(' ')[0]}`,
      gender,
      guardianPhone: randomPhone(),
      birthDate: randomBirthDate(),
      joinedAt: Math.random() > 0.15 ? randomJoinedAt(academicYear) : `${academicYear}-02-03`,
      isActive: true,
      clubId,
      address: randomAddress(),
    };
    try {
      const res = await http.request('post', '/children', { data: dto });
      created.push(res.data);
      logger.info(`[children/create] +1 criança "${name}" no clube #${clubNumber}`);
    } catch (e) {
      logger.warn(`[children/create] falhou "${name}" clube #${clubNumber}: ${e.response?.data?.message || e.message}`);
    }
  }
  return created;
}

async function run({ http, logger, ctx }) {
  const childrenPerClub = ctx?.childrenPerClub ?? 10;
  const academicYear = ctx?.year ?? ACADEMIC_YEAR;

  logger.info(`[children/create] criando ${childrenPerClub} crianças por clube...`);

  const clubsRes = await http.request('get', '/clubs/all');
  const clubs = Array.isArray(clubsRes.data) ? clubsRes.data : [];

  if (clubs.length === 0) {
    logger.warn('[children/create] nenhum clube encontrado. Pulando.');
    return { created: 0 };
  }

  let totalCreated = 0;
  for (const club of clubs) {
    // Verifica quantas crianças o clube já tem
    let existingCount = 0;
    try {
      const clubDetail = await http.request('get', `/clubs/${club.id}`);
      const children = clubDetail.data?.children || [];
      existingCount = Array.isArray(children) ? children.length : 0;
    } catch (_) {}

    const toCreate = Math.max(0, childrenPerClub - existingCount);
    if (toCreate === 0) {
      logger.info(`[children/create] clube #${club.number} já tem ${existingCount} crianças. Pulando.`);
      continue;
    }

    const created = await createChildrenForClub({
      http, logger, clubId: club.id, clubNumber: club.number,
      count: toCreate, academicYear,
    });
    totalCreated += created.length;
  }

  logger.info(`[children/create] OK total criadas=${totalCreated}`);
  return { created: totalCreated };
}

module.exports = { run, createChildrenForClub };
