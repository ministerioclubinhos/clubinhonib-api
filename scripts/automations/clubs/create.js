const { randomClubNumber, randomWeekday, randomTime, randomAddress } = require('../common/random');
const { ensureRoleClients, findTeacherProfileByUserId, findCoordinatorProfileByUserId } = require('../common/role-users');
const { expectHttpError, errorMessage } = require('../common/errors');

async function listAllClubs(http) {
  const res = await http.request('get', '/clubs/all');
  return Array.isArray(res.data) ? res.data : [];
}

async function createClub({ http, overrides = {} }) {
  const dto = {
    number: randomClubNumber(),
    weekday: randomWeekday(),
    time: Math.random() > 0.2 ? randomTime() : undefined,
    isActive: true,
    address: randomAddress(),
    ...overrides,
  };
  const res = await http.request('post', '/clubs', { data: dto });
  return res.data;
}

/**
 * Garante o mínimo de clubinhos. O primeiro fica sob o coordenador fixo com o
 * professor fixo dentro — é a base dos cenários de escopo (coordenador e
 * professor só enxergam o próprio clubinho). O coordenador também cria um
 * clubinho, que a API atribui a ele mesmo.
 */
async function run({ http, logger, ctx }) {
  logger.section('clubs/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const minClubs = ctx?.minClubs ?? 6;

  const coordinatorProfile = ctx.roleUsers?.coordinator ? await findCoordinatorProfileByUserId(http, ctx.roleUsers.coordinator.id) : null;
  const teacherProfile = ctx.roleUsers?.teacher ? await findTeacherProfileByUserId(http, ctx.roleUsers.teacher.id) : null;
  ctx.coordinatorProfileId = coordinatorProfile?.id ?? null;
  ctx.teacherProfileId = teacherProfile?.id ?? null;

  let clubs = await listAllClubs(http);
  logger.info(`[clubs/create] existentes=${clubs.length} mínimo=${minClubs}`);

  // O clubinho de referência dos cenários de papel.
  let anchor = null;
  if (coordinatorProfile?.id) {
    const withCoordinator = clubs.filter((c) => c.coordinatorProfileId === coordinatorProfile.id);
    if (withCoordinator.length === 0) {
      await logger.check('POST /clubs com coordenador e professor fixos', async () => {
        anchor = await createClub({
          http,
          overrides: { coordinatorProfileId: coordinatorProfile.id, teacherProfileIds: teacherProfile?.id ? [teacherProfile.id] : undefined },
        });
        if (anchor.coordinator?.id !== coordinatorProfile.id) throw new Error('coordinator não veio na resposta');
        if (teacherProfile?.id && !anchor.teachers?.some((t) => t.id === teacherProfile.id)) throw new Error('professor fixo não veio em teachers');
        return `club #${anchor.number} id=${anchor.id}`;
      });
    }
  }

  if (!anchor && coordinatorProfile?.id) {
    // Encontra o clubinho já ligado ao coordenador fixo pelo detalhe.
    for (const c of clubs) {
      const detail = await http.request('get', `/clubs/${c.id}`);
      if (detail.data?.coordinator?.id === coordinatorProfile.id) {
        anchor = detail.data;
        break;
      }
    }
    if (anchor && teacherProfile?.id && !anchor.teachers?.some((t) => t.id === teacherProfile.id)) {
      await http.request('patch', `/teacher-profiles/${teacherProfile.id}/assign-club`, { data: { clubId: anchor.id } });
      logger.info(`[clubs/create] professor fixo vinculado ao clubinho #${anchor.number}`);
    }
  }

  clubs = await listAllClubs(http);
  const toCreate = Math.max(0, minClubs - clubs.length);
  let created = 0;
  for (let i = 0; i < toCreate; i++) {
    try {
      await createClub({ http });
      created++;
    } catch (e) {
      logger.warn(`[clubs/create] falhou: ${errorMessage(e)}`);
    }
  }
  logger.ok(`[clubs/create] criados=${created}`);

  if (as.coordinator) {
    await logger.check('POST /clubs como coordenador fica sob a própria coordenação', async () => {
      const res = await as.coordinator.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'saturday', time: '9:30', address: randomAddress() } });
      if (res.data?.coordinator?.id !== coordinatorProfile?.id) throw new Error(`coordinator=${res.data?.coordinator?.id} esperado=${coordinatorProfile?.id}`);
      if (res.data?.time !== '09:30') throw new Error(`time normalizado esperado 09:30, veio ${res.data?.time}`);
      return `club #${res.data.number}`;
    });
  }

  // Sem índice único em `clubs.number`: a API aceita número repetido. Fica
  // como aviso — `POST /auth/link-club` procura o clubinho pelo número.
  await logger.check('POST /clubs com número repetido é recusado (409/400)', async () => {
    const existing = (await listAllClubs(http))[0];
    let duplicate = null;
    try {
      duplicate = (await http.request('post', '/clubs', { data: { number: existing.number, weekday: 'monday' } })).data;
    } catch (e) {
      if ([400, 409, 422].includes(e.response?.status)) return 'recusado';
      throw e;
    }
    await http.request('delete', `/clubs/${duplicate.id}`);
    throw new Error(`API aceitou número repetido #${existing.number} (sem unicidade em clubs.number)`);
  }, { soft: true });

  await logger.check('POST /clubs com weekday inválido responde 400/422', () =>
    expectHttpError(() => http.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'domingo' } }), [400, 422], 'club weekday'),
  );

  await logger.check('POST /clubs com time fora do formato responde 400/422', () =>
    expectHttpError(() => http.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'monday', time: '25:99' } }), [400, 422], 'club time'),
  );

  if (as.teacher) {
    await logger.check('POST /clubs como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'monday' } }), 403, 'club teacher'),
    );
  }

  ctx.clubs = await listAllClubs(http);
  ctx.anchorClub = anchor ?? null;
  logger.ok(`[clubs/create] total=${ctx.clubs.length} anchor=${anchor ? `#${anchor.number}` : 'n/a'}`);
  return { clubs: ctx.clubs, anchor };
}

module.exports = { run, createClub, listAllClubs };
