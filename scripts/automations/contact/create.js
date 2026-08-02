const { randomName, randomEmail, randomPhone, randomContactMessage } = require('../common/random');
const { sleep } = require('../common/sleep');

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;

  // Verifica quantos contatos já existem
  let existing = 0;
  try {
    const listRes = await http.request('get', '/contact', { params: { page: 1, limit: 1 } });
    existing = listRes.data?.total ?? listRes.data?.meta?.totalItems ?? 0;
  } catch (_) {}

  const toCreate = Math.max(0, min - existing);
  logger.info(`[contact/create] garantindo mínimo ${min} contatos (atual=${existing}, criando=${toCreate})...`);

  let created = 0;
  for (let i = 0; i < toCreate; i++) {
    const email = randomEmail('contato');
    const dto = {
      name: randomName(),
      email,
      phone: randomPhone(),
      message: randomContactMessage(),
    };
    try {
      const res = await http.request('post', '/contact', { data: dto });
      created++;
      logger.info(`[contact/create] +1 contato de "${dto.name}"`);
      await sleep(30);
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.message || e.message;

      // Às vezes o endpoint retorna 500 por e-mail config mas persiste mesmo assim
      if (status === 500 && String(msg).toLowerCase().includes('e-mail')) {
        logger.warn(`[contact/create] API retornou 500 por e-mail (esperado em dev) - dado pode ter sido persistido`);
        created++;
      } else {
        logger.warn(`[contact/create] falhou: ${msg}`);
      }
    }
  }

  logger.info(`[contact/create] OK criados=${created}`);
  return { created };
}

module.exports = { run };
