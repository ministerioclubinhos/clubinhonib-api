const { fetchAllPages } = require('../common/pagination');
const { randomName, randomEmail, randomPhone } = require('../common/random');
const { sleep } = require('../common/sleep');

async function findCoordinatorProfileByUserId({ http, userId }) {
  const page = await http.request('get', '/coordinator-profiles', { params: { page: 1, limit: 2000 } });
  const items = page.data?.items || page.data?.data || page.data || [];
  return items.find((c) => c.user?.id === userId) || null;
}

async function findTeacherProfileByUserId({ http, userId }) {
  const page = await http.request('get', '/teacher-profiles', { params: { page: 1, limit: 2000 } });
  const items = page.data?.items || page.data?.data || page.data || [];
  return items.find((t) => t.user?.id === userId) || null;
}

async function ensureCoordinatorForClub({ http, logger, clubId, clubNumber }) {
  const details = await http.request('get', `/clubs/${clubId}`);
  const coordinator = details.data?.coordinator;
  if (coordinator?.id) return { ensured: true, created: false };

  // criar user coordinator
  const userRes = await http.request('post', '/users', {
    data: {
      name: randomName(),
      email: randomEmail('coordinator'),
      password: 'Senha123@',
      phone: randomPhone(),
      role: 'coordinator',
      active: true,
      completed: true,
    },
  });
  await sleep(500);
  const coordProfile = await findCoordinatorProfileByUserId({ http, userId: userRes.data?.id });
  if (!coordProfile?.id) {
    logger.warn(`[clubs/list-fix] coordenador profile não encontrado p/ user=${userRes.data?.id} club=${clubNumber}`);
    return { ensured: false, created: true };
  }

  await http.request('patch', `/coordinator-profiles/${coordProfile.id}/assign-club`, {
    data: { clubId },
  });
  logger.info(`[clubs/list-fix] club #${clubNumber} recebeu coordenador=${coordProfile.id}`);
  return { ensured: true, created: true };
}

async function ensureTeachersForClub({ http, logger, clubId, clubNumber, minTeachers = 10 }) {
  const details = await http.request('get', `/clubs/${clubId}`);
  const teachers = Array.isArray(details.data?.teachers) ? details.data.teachers : [];
  const current = teachers.length;
  const needed = Math.max(0, minTeachers - current);
  if (needed === 0) return { ensured: true, created: 0 };

  let created = 0;
  for (let i = 0; i < needed; i++) {
    try {
      const userRes = await http.request('post', '/users', {
        data: {
          name: randomName(),
          email: randomEmail('teacher'),
          password: 'Senha123@',
          phone: randomPhone(),
          role: 'teacher',
          active: true,
          completed: true,
        },
      });
      await sleep(500);
      const teacherProfile = await findTeacherProfileByUserId({ http, userId: userRes.data?.id });
      if (!teacherProfile?.id) {
        logger.warn(`[clubs/list-fix] teacher profile não encontrado p/ user=${userRes.data?.id} club=${clubNumber}`);
        continue;
      }
      await http.request('patch', `/teacher-profiles/${teacherProfile.id}/assign-club`, { data: { clubId } });
      created++;
      logger.info(`[clubs/list-fix] club #${clubNumber} +teacher=${teacherProfile.id}`);
    } catch (e) {
      logger.warn(`[clubs/list-fix] erro ao criar/vincular teacher club #${clubNumber}: ${e.response?.data?.message || e.message}`);
    }
  }
  return { ensured: true, created };
}

async function run({ http, logger, ctx }) {
  const minTeachers = ctx?.minTeachersPerClub ?? 10;

  logger.info('[clubs/list-fix] listando clubs paginados (todas as páginas)...');
  const clubs = await fetchAllPages(http.request, 'get', '/clubs', { sort: 'updatedAt', order: 'DESC' }, { limit: 50 });
  logger.info(`[clubs/list-fix] total clubs=${clubs.length}`);

  let fixedCoordinators = 0;
  let fixedTeachers = 0;

  for (const club of clubs) {
    const id = club.id;
    const number = club.number;
    if (!id) continue;

    const coordRes = await ensureCoordinatorForClub({ http, logger, clubId: id, clubNumber: number });
    if (coordRes.created) fixedCoordinators++;

    const teacherRes = await ensureTeachersForClub({ http, logger, clubId: id, clubNumber: number, minTeachers });
    fixedTeachers += teacherRes.created || 0;
  }

  logger.info(`[clubs/list-fix] OK fixed coordinators=${fixedCoordinators} added teachers=${fixedTeachers}`);
  return { clubs, fixedCoordinators, fixedTeachers };
}

module.exports = { run };


