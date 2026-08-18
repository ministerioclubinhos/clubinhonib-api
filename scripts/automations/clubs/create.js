const { randomClubNumber, randomWeekday, randomTime, randomAddress } = require('../common/random');

const WEEKDAY_LABELS = {
  monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
  thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado',
};

// Garante diversidade de dias da semana nos clubes criados
function buildWeekdayQueue(count) {
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const queue = [];
  // Garante pelo menos 1 de cada dia
  for (const day of weekdays) queue.push(day);
  // Preenche o resto aleatoriamente
  while (queue.length < count) {
    queue.push(weekdays[Math.floor(Math.random() * weekdays.length)]);
  }
  // Embaralha
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

async function createClubs({ http, logger, count = 5, existingNumbers = new Set() }) {
  const created = [];
  const weekdayQueue = buildWeekdayQueue(count);

  for (let i = 0; i < count; i++) {
    let number;
    let attempts = 0;
    do {
      number = randomClubNumber();
      attempts++;
    } while (existingNumbers.has(number) && attempts < 20);

    const weekday = weekdayQueue[i] || randomWeekday();
    const dto = {
      number,
      weekday,
      time: randomTime(),
      isActive: true,
      address: randomAddress(),
    };
    try {
      const res = await http.request('post', '/clubs', { data: dto });
      created.push(res.data);
      existingNumbers.add(number);
      logger.info(`[clubs/create] +1 clube #${number} (${WEEKDAY_LABELS[weekday] || weekday})`);
    } catch (e) {
      logger.warn(`[clubs/create] falhou #${number}: ${e.response?.data?.message || e.message}`);
    }
  }
  return created;
}

async function run({ http, logger, ctx }) {
  const minClubs = ctx?.minClubs ?? 10;
  logger.info(`[clubs/create] garantindo pelo menos ${minClubs} clubes...`);

  const existing = await http.request('get', '/clubs/all');
  const clubs = Array.isArray(existing.data) ? existing.data : [];
  const existingNumbers = new Set(clubs.map((c) => c.number));

  if (clubs.length >= minClubs) {
    logger.info(`[clubs/create] OK já existem ${clubs.length} clubes`);
    return { clubs, created: [] };
  }

  const toCreate = minClubs - clubs.length;
  const created = await createClubs({ http, logger, count: toCreate, existingNumbers });
  const updated = await http.request('get', '/clubs/all');
  const final = Array.isArray(updated.data) ? updated.data : [];
  logger.info(`[clubs/create] OK total=${final.length} (criados=${created.length})`);
  return { clubs: final, created };
}

module.exports = { run, createClubs };
