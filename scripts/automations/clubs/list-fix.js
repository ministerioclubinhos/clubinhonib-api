const { fetchAllPages } = require('../common/pagination');
const { randomName, randomEmail, randomPhone, randomAddress, randomClubNumber } = require('../common/random');
const { DEFAULT_PASSWORD, EMAIL_DOMAIN } = require('../common/config');
const { ensureRoleClients, findTeacherProfileByUserId, findCoordinatorProfileByUserId } = require('../common/role-users');
const { expectHttpError, errorMessage } = require('../common/errors');
const { listAllClubs } = require('./create');

async function createUserWithProfile({ http, role }) {
  const userRes = await http.request('post', '/users', {
    data: { name: randomName(), email: randomEmail(role), password: DEFAULT_PASSWORD, phone: randomPhone(), role, active: true, completed: true, commonUser: true },
  });
  const finder = role === 'coordinator' ? findCoordinatorProfileByUserId : findTeacherProfileByUserId;
  const profile = await finder(http, userRes.data.id);
  if (!profile?.id) throw new Error(`perfil de ${role} não encontrado para user=${userRes.data.id}`);
  return { user: userRes.data, profile };
}

async function ensureCoordinatorForClub({ http, logger, club }) {
  const details = await http.request('get', `/clubs/${club.id}`);
  if (details.data?.coordinator?.id) return false;
  const { profile } = await createUserWithProfile({ http, role: 'coordinator' });
  await http.request('patch', `/coordinator-profiles/${profile.id}/assign-club`, { data: { clubId: club.id } });
  logger.info(`[clubs/list-fix] club #${club.number} recebeu coordenador ${profile.id}`);
  return true;
}

async function ensureTeachersForClub({ http, logger, club, minTeachers }) {
  const details = await http.request('get', `/clubs/${club.id}`);
  const current = Array.isArray(details.data?.teachers) ? details.data.teachers.length : 0;
  let created = 0;
  for (let i = current; i < minTeachers; i++) {
    try {
      const { profile } = await createUserWithProfile({ http, role: 'teacher' });
      await http.request('patch', `/teacher-profiles/${profile.id}/assign-club`, { data: { clubId: club.id } });
      created++;
    } catch (e) {
      logger.warn(`[clubs/list-fix] professor para club #${club.number} falhou: ${errorMessage(e)}`);
    }
  }
  return created;
}

/**
 * Listagem paginada com filtros, detalhe, edição, ativação, opções, remoção
 * de descartável e escopo por papel. Fix: todo clubinho tem coordenador e o
 * mínimo de professores.
 */
async function run({ http, logger, ctx }) {
  logger.section('clubs/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });
  const minTeachers = ctx?.minTeachersPerClub ?? 3;

  const clubs = await fetchAllPages(http.request, 'get', '/clubs', { sort: 'updatedAt', order: 'DESC' }, { limit: 50 });
  logger.ok(`GET /clubs todas as páginas total=${clubs.length} (total=${clubs.totalReported})`);

  for (const params of [{ isActive: true }, { searchString: 'Centro' }, { sort: 'number', order: 'asc' }]) {
    await logger.check(`GET /clubs filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/clubs', { params: { ...params, page: 1, limit: 10 } });
      if (params.isActive && res.data.data.some((c) => c.isActive !== true)) throw new Error('isActive vazou inativo');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  await logger.check('GET /clubs com sort inválido responde 400/422', () =>
    expectHttpError(() => http.request('get', '/clubs', { params: { sort: 'hacker' } }), [400, 422], 'clubs sort'),
  );

  let fixedCoordinators = 0;
  let fixedTeachers = 0;
  for (const club of clubs) {
    if (!club?.id) continue;
    try {
      if (await ensureCoordinatorForClub({ http, logger, club })) fixedCoordinators++;
      fixedTeachers += await ensureTeachersForClub({ http, logger, club, minTeachers });
    } catch (e) {
      logger.warn(`[clubs/list-fix] fix club #${club.number} falhou: ${errorMessage(e)}`);
    }
  }
  logger.ok(`[clubs/list-fix] fix coordenadores=${fixedCoordinators} professores adicionados=${fixedTeachers}`);

  await logger.check('GET /clubs/all e GET /clubs/simple-options', async () => {
    const [all, options] = await Promise.all([http.request('get', '/clubs/all'), http.request('get', '/clubs/simple-options')]);
    if (!Array.isArray(all.data) || !Array.isArray(options.data)) throw new Error('esperava arrays');
    if (options.data.length && !options.data[0].label) throw new Error('simple-options sem label');
    return `all=${all.data.length} options=${options.data.length} ex="${options.data[0]?.label ?? ''}"`;
  });

  const sample = clubs[0];
  if (sample?.id) {
    await logger.check(`GET /clubs/${sample.id} traz coordenador e professores`, async () => {
      const res = await http.request('get', `/clubs/${sample.id}`);
      if (!('coordinator' in res.data) || !Array.isArray(res.data.teachers)) throw new Error('contrato sem coordinator/teachers');
      return `#${res.data.number} teachers=${res.data.teachers.length}`;
    });
  }

  await logger.check('ciclo POST→PATCH→toggle-active→DELETE de clubinho descartável', async () => {
    const created = await http.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'friday', time: '19:00', address: randomAddress() } });
    const id = created.data.id;
    const patched = await http.request('patch', `/clubs/${id}`, { data: { time: null, weekday: 'saturday', address: { street: 'Rua Editada', city: 'Campinas', state: 'SP' } } });
    if (patched.data.time !== null || patched.data.weekday !== 'saturday') throw new Error('PATCH não aplicou time/weekday');
    if (patched.data.address?.street !== 'Rua Editada') throw new Error('PATCH não aplicou address');
    const off = await http.request('patch', `/clubs/${id}/toggle-active`);
    if (off.data.isActive !== false) throw new Error('toggle não desativou');
    const on = await http.request('patch', `/clubs/${id}/toggle-active`);
    if (on.data.isActive !== true) throw new Error('toggle não reativou');
    const del = await http.request('delete', `/clubs/${id}`);
    await expectHttpError(() => http.request('get', `/clubs/${id}`), 404, 'club removido');
    return `id=${id} ${del.data?.message ?? ''}`;
  });

  // Escopo por papel.
  if (as.teacher) {
    await logger.check('GET /clubs como professor responde 403; /clubs/all só o próprio clubinho', async () => {
      await expectHttpError(() => as.teacher.request('get', '/clubs'), 403, 'clubs teacher');
      const me = await as.teacher.request('get', '/auth/me');
      const own = me.data?.teacherProfile?.club?.id;
      const all = await as.teacher.request('get', '/clubs/all');
      if (own && (all.data.length !== 1 || all.data[0].id !== own)) throw new Error(`professor viu ${all.data.length} clubinhos`);
      return `own=${own ?? 'nenhum'} visíveis=${all.data.length}`;
    });
  }
  if (as.coordinator) {
    await logger.check('GET /clubs como coordenador lista só os clubinhos sob a coordenação', async () => {
      const me = await as.coordinator.request('get', '/auth/me');
      const ownIds = new Set((me.data?.coordinatorProfile?.clubs ?? []).map((c) => c.id));
      const page = await fetchAllPages(as.coordinator.request, 'get', '/clubs', {}, { limit: 50 });
      const strangers = page.filter((c) => !ownIds.has(c.id));
      if (strangers.length) throw new Error(`coordenador viu ${strangers.length} clubinhos de outra coordenação`);
      return `visíveis=${page.length}`;
    });
    const other = clubs.find((c) => !(ctx.coordinatorProfileId && c.coordinator?.id === ctx.coordinatorProfileId));
    if (other) {
      await logger.check('PATCH /clubs/:id de outra coordenação como coordenador responde 403/404', () =>
        expectHttpError(() => as.coordinator.request('patch', `/clubs/${other.id}`, { data: { time: '10:00' } }), [403, 404], 'club coord alheio'),
      );
    }
  }
  if (as.coordinatorNoClubs) {
    await logger.check('GET /clubs como coordenador sem clubinho vem vazio', async () => {
      const res = await as.coordinatorNoClubs.request('get', '/clubs', { params: { page: 1, limit: 10 } });
      if (res.data.total !== 0) throw new Error(`esperava total=0, veio ${res.data.total}`);
      return 'total=0';
    });
  }
  await logger.check('GET /clubs anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/clubs'), 401, 'clubs anônimo'),
  );

  ctx.clubs = await listAllClubs(http);
  return { clubs: ctx.clubs, fixedCoordinators, fixedTeachers };
}

module.exports = { run, createUserWithProfile };
