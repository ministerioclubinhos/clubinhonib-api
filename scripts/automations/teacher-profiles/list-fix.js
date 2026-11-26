const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorMessage } = require('../common/errors');
const { EMAIL_DOMAIN } = require('../common/config');

/**
 * Listagem (`{ items, total, page, limit }`) com filtros, simples, detalhe,
 * por clubinho, vínculo/desvínculo e escopo do coordenador.
 * Fix: professor da automação sem clubinho é vinculado ao clubinho com menos
 * professores (o professor fixo "sem clubinho" fica de fora de propósito).
 */
async function run({ http, logger, ctx }) {
  logger.section('teacher-profiles/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const teachers = await fetchAllPages(http.request, 'get', '/teacher-profiles', { sort: 'createdAt', order: 'desc' }, { limit: 100, maxPages: 200 });
  logger.ok(`GET /teacher-profiles todas as páginas total=${teachers.length} (total=${teachers.totalReported})`);

  for (const params of [{ hasClub: false }, { active: true }, { searchString: 'automa' }, ...(ctx.clubs?.[0] ? [{ clubNumber: ctx.clubs[0].number }] : [])]) {
    await logger.check(`GET /teacher-profiles filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/teacher-profiles', { params: { ...params, page: 1, limit: 20 } });
      if (params.hasClub === false && res.data.items.some((t) => t.club)) throw new Error('hasClub=false devolveu professor com clubinho');
      return `items=${res.data.items.length} total=${res.data.total}`;
    });
  }

  await logger.check('GET /teacher-profiles/simple', async () => {
    const res = await http.request('get', '/teacher-profiles/simple');
    if (!Array.isArray(res.data)) throw new Error('esperava array');
    if (res.data.length && !('vinculado' in res.data[0])) throw new Error('item sem campo vinculado');
    return `total=${res.data.length}`;
  });

  const withClub = teachers.find((t) => t.club?.id);
  if (withClub) {
    await logger.check(`GET /teacher-profiles/${withClub.id} e by-club/${withClub.club.id}`, async () => {
      const [one, byClub] = await Promise.all([
        http.request('get', `/teacher-profiles/${withClub.id}`),
        http.request('get', `/teacher-profiles/by-club/${withClub.club.id}`),
      ]);
      if (!byClub.data.some((t) => t.id === one.data.id)) throw new Error('professor não apareceu em by-club');
      return `byClub=${byClub.data.length}`;
    });
  }

  // Fix: vincula os professores da automação que ficaram sem clubinho.
  const clubs = ctx.clubs ?? [];
  const excluded = new Set([ctx.roleUsers?.teacherUnlinked?.id, ctx.roleUsers?.teacherInactive?.id].filter(Boolean));
  let fixed = 0;
  if (clubs.length) {
    const counts = new Map(clubs.map((c) => [c.id, 0]));
    for (const t of teachers) if (t.club?.id && counts.has(t.club.id)) counts.set(t.club.id, counts.get(t.club.id) + 1);
    for (const t of teachers) {
      if (t.club?.id || !t.user?.email?.endsWith(`@${EMAIL_DOMAIN}`) || excluded.has(t.user?.id)) continue;
      const [targetId] = [...counts.entries()].sort((a, b) => a[1] - b[1])[0];
      try {
        await http.request('patch', `/teacher-profiles/${t.id}/assign-club`, { data: { clubId: targetId } });
        counts.set(targetId, counts.get(targetId) + 1);
        fixed++;
      } catch (e) {
        logger.warn(`[teacher-profiles/list-fix] fix ${t.id} falhou: ${errorMessage(e)}`);
      }
    }
  }
  logger.ok(`[teacher-profiles/list-fix] fixAssigned=${fixed}`);

  const extra = ctx.extraTeacherProfileId;
  if (extra && clubs.length > 1) {
    await logger.check('assign-club para outro clubinho move o professor; unassign-club desvincula', async () => {
      const detail = await http.request('get', `/teacher-profiles/${extra}`);
      const target = clubs.find((c) => c.id !== detail.data?.club?.id);
      await http.request('patch', `/teacher-profiles/${extra}/assign-club`, { data: { clubId: target.id } });
      const moved = await http.request('get', `/teacher-profiles/${extra}`);
      if (moved.data?.club?.id !== target.id) throw new Error('não moveu');
      await http.request('patch', `/teacher-profiles/${extra}/unassign-club`, { data: { clubId: target.id } });
      const free = await http.request('get', `/teacher-profiles/${extra}`);
      if (free.data?.club) throw new Error('não desvinculou');
      await http.request('patch', `/teacher-profiles/${extra}/assign-club`, { data: { clubId: target.id } });
      return `movido para #${target.number}`;
    });
  }

  if (as.coordinator) {
    await logger.check('GET /teacher-profiles como coordenador lista só professores dos próprios clubinhos', async () => {
      const me = await as.coordinator.request('get', '/auth/me');
      const ownIds = new Set((me.data?.coordinatorProfile?.clubs ?? []).map((c) => c.id));
      const page = await fetchAllPages(as.coordinator.request, 'get', '/teacher-profiles', {}, { limit: 100 });
      const strangers = page.filter((t) => t.club && !ownIds.has(t.club.id));
      if (strangers.length) throw new Error(`coordenador viu ${strangers.length} professores de outra coordenação`);
      return `visíveis=${page.length}`;
    });
    const foreign = clubs.find((c) => !ctx.anchorClub || c.id !== ctx.anchorClub.id);
    if (foreign && extra) {
      await logger.check('assign-club para clubinho de outra coordenação como coordenador responde 403', () =>
        expectHttpError(() => as.coordinator.request('patch', `/teacher-profiles/${extra}/assign-club`, { data: { clubId: foreign.id } }), [403, 404], 'assign coord alheio'),
      );
    }
  }
  if (as.teacher) {
    await logger.check('GET /teacher-profiles como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('get', '/teacher-profiles'), 403, 'teachers teacher'),
    );
  }
  await logger.check('GET /teacher-profiles anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/teacher-profiles'), 401, 'teachers anônimo'),
  );

  return { teachers, fixed };
}

module.exports = { run };
