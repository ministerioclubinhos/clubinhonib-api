const { randomName, randomEmail, randomPhone } = require('../common/random');
const { sleep } = require('../common/sleep');

async function run({ http, logger }) {
  
  const userDto = {
    name: randomName(),
    email: randomEmail('coordinator'),
    password: 'Senha123@',
    phone: randomPhone(),
    role: 'coordinator',
    active: true,
    completed: true,
  };

  logger.info(`[coordinator-profiles/create] criando user coordinator (${userDto.email})...`);
  const userRes = await http.request('post', '/users', { data: userDto });
  await sleep(600);

  const page = await http.request('get', '/coordinator-profiles', { params: { page: 1, limit: 2000 } });
  const items = page.data?.items || page.data?.data || page.data || [];
  const found = items.find((c) => c.user?.id === userRes.data?.id);
  logger.info(`[coordinator-profiles/create] OK created userId=${userRes.data?.id} coordinatorProfileId=${found?.id ?? 'n/a'}`);

  return { userId: userRes.data?.id, coordinatorProfileId: found?.id ?? null };
}

module.exports = { run };


