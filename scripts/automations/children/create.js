const { randomName, randomBirthDate, randomGender, randomPhone, randomJoinedAt, randomJoinedAtWithin, randomAddress } = require('../common/random');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorMessage } = require('../common/errors');
const { fetchAllPages } = require('../common/pagination');

function buildChild({ clubId, period, withAddress = Math.random() > 0.3 }) {
  // Metade entra no meio do período letivo: gera pagelas parciais de verdade.
  const joinedAt = period && Math.random() > 0.5 ? randomJoinedAtWithin(period.startDate, period.endDate) : randomJoinedAt();
  return {
    name: randomName(),
    birthDate: randomBirthDate(),
    guardianName: randomName(),
    gender: randomGender(),
    guardianPhone: randomPhone(),
    joinedAt,
    isActive: Math.random() > 0.15,
    clubId,
    address: withAddress ? randomAddress() : undefined,
  };
}

async function createChildrenForClubs({ http, logger, clubs, countPerClub, period }) {
  const created = [];
  for (const club of clubs) {
    let ok = 0;
    for (let i = 0; i < countPerClub; i++) {
      try {
        const res = await http.request('post', '/children', { data: buildChild({ clubId: club.id, period }) });
        if (res.data?.club?.id !== club.id) throw new Error('resposta sem club.id');
        created.push(res.data);
        ok++;
      } catch (e) {
        logger.warn(`[children/create] club #${club.number}: ${errorMessage(e)}`);
      }
    }
    logger.info(`[children/create] club #${club.number} +${ok}`);
  }
  return created;
}

/**
 * Crianças por clubinho até o mínimo configurado, uma sem clubinho, e os
 * cenários de escopo: professor cria no próprio clubinho, mas não em outro;
 * coordenador sem clubinho não cria em clubinho alheio.
 */
async function run({ http, logger, ctx }) {
  logger.section('children/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const clubs = ctx.clubs ?? (await http.request('get', '/clubs/all')).data;
  const countPerClub = ctx?.childrenPerClub ?? 10;
  const period = ctx.period ?? null;

  // Só completa o que falta: rodar de novo não duplica crianças.
  const existing = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100 });
  const perClub = new Map();
  for (const c of existing) if (c.club?.id) perClub.set(c.club.id, (perClub.get(c.club.id) ?? 0) + 1);

  let created = [];
  for (const club of clubs) {
    const missing = Math.max(0, countPerClub - (perClub.get(club.id) ?? 0));
    if (missing > 0) created = created.concat(await createChildrenForClubs({ http, logger, clubs: [club], countPerClub: missing, period }));
  }
  logger.ok(`[children/create] criadas=${created.length} (existentes=${existing.length})`);

  await logger.check('POST /children sem clubinho (lista de espera)', async () => {
    const res = await http.request('post', '/children', { data: { ...buildChild({ clubId: undefined, period }), clubId: undefined } });
    if (res.data.club !== null) throw new Error('esperava club=null');
    ctx.orphanChildId = res.data.id;
    return `id=${res.data.id}`;
  });

  await logger.check('POST /children com gender inválido responde 400/422', () =>
    expectHttpError(() => http.request('post', '/children', { data: { ...buildChild({}), gender: 'X' } }), [400, 422], 'child gender'),
  );
  await logger.check('POST /children com nome de 1 letra responde 400/422', () =>
    expectHttpError(() => http.request('post', '/children', { data: { ...buildChild({}), name: 'A' } }), [400, 422], 'child name'),
  );
  await logger.check('POST /children com clubId inexistente responde 404', () =>
    expectHttpError(() => http.request('post', '/children', { data: buildChild({ clubId: '00000000-0000-4000-8000-000000000000' }) }), [404, 403], 'child club inexistente'),
  );

  if (as.teacher) {
    const me = await as.teacher.request('get', '/auth/me');
    const ownClubId = me.data?.teacherProfile?.club?.id;
    const otherClub = clubs.find((c) => c.id !== ownClubId);
    if (ownClubId) {
      await logger.check('POST /children como professor no próprio clubinho', async () => {
        const res = await as.teacher.request('post', '/children', { data: buildChild({ clubId: ownClubId, period, withAddress: true }) });
        ctx.teacherChildId = res.data.id;
        return `id=${res.data.id}`;
      });
    }
    if (otherClub) {
      await logger.check('POST /children como professor em outro clubinho responde 403', () =>
        expectHttpError(() => as.teacher.request('post', '/children', { data: buildChild({ clubId: otherClub.id, period }) }), 403, 'child teacher alheio'),
      );
    }
  }
  if (as.coordinatorNoClubs && clubs[0]) {
    await logger.check('POST /children como coordenador sem clubinho responde 403', () =>
      expectHttpError(() => as.coordinatorNoClubs.request('post', '/children', { data: buildChild({ clubId: clubs[0].id, period }) }), 403, 'child coord sem clube'),
    );
  }
  await logger.check('POST /children anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('post', '/children', { data: buildChild({}) }), 401, 'child anônimo'),
  );

  return { children: created };
}

module.exports = { run, createChildrenForClubs, buildChild };
