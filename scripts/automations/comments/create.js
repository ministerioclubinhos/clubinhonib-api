const { randomName, randomComment, randomNeighborhood } = require('../common/random');
const { sleep } = require('../common/sleep');

const CLUBINHO_NAMES = [
  'Clubinho da Alegria', 'Clubinho Esperança', 'Clubinho Luz do Mundo',
  'Clubinho Shekinah', 'Clubinho Maranata', 'Clubinho Betel',
  'Clubinho Siloé', 'Clubinho Filadélfia', 'Clubinho Gênesis',
  'Clubinho Ágape', 'Clubinho Nova Vida', 'Clubinho Rute',
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;

  // Verifica quantos comentários já existem
  let existing = 0;
  try {
    const listRes = await http.request('get', '/comments', { params: { page: 1, limit: 1 } });
    existing = listRes.data?.total ?? listRes.data?.meta?.totalItems ?? 0;
  } catch (_) {}

  const toCreate = Math.max(0, min - existing);
  logger.info(`[comments/create] garantindo mínimo ${min} comentários (atual=${existing}, criando=${toCreate})...`);

  let created = 0;
  for (let i = 0; i < toCreate; i++) {
    const dto = {
      name: randomName(),
      comment: randomComment(),
      clubinho: CLUBINHO_NAMES[Math.floor(Math.random() * CLUBINHO_NAMES.length)],
      neighborhood: randomNeighborhood(),
    };
    try {
      await http.request('post', '/comments', { data: dto });
      created++;
      logger.info(`[comments/create] +1 comentário de "${dto.name}" (${dto.neighborhood})`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[comments/create] falhou: ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[comments/create] OK criados=${created}`);
  return { created };
}

module.exports = { run };
