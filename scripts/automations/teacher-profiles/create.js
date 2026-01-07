const { randomName, randomEmail, randomPhone } = require('../common/random');
const { sleep } = require('../common/sleep');

async function run({ http, logger }) {
  
  const userDto = {
    name: randomName(),
    email: randomEmail('teacher'),
    password: 'Senha123@',
    phone: randomPhone(),
    role: 'teacher',
    active: true,
    completed: true,
  };

  logger.info(`[teacher-profiles/create] creating teacher user (${userDto.email})...`);
  const userRes = await http.request('post', '/users', { data: userDto });
  await sleep(600);

  
  const page = await http.request('get', '/teacher-profiles', { params: { page: 1, limit: 2000 } });
  const items = page.data?.items || page.data?.data || page.data || [];
  const found = items.find((t) => t.user?.id === userRes.data?.id);
  logger.info(`[teacher-profiles/create] OK created userId=${userRes.data?.id} teacherProfileId=${found?.id ?? 'n/a'}`);

  return { userId: userRes.data?.id, teacherProfileId: found?.id ?? null };
}

module.exports = { run };


