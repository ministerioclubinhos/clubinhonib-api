const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { fetchAllPages } = require('../common/pagination');

/**
 * Decisões (`ACCEPTED`, `RECONCILED` e sem decisão informada) para uma parte
 * das crianças, e os escopos: professor registra só no próprio clubinho.
 */
async function run({ http, logger, ctx }) {
  logger.section('accepted-christs/create');
  const as = await ensureRoleClients({ http, logger, ctx });

  const children = ctx.children ?? (await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100 }));
  const withClub = children.filter((c) => c.club?.id);
  if (!withClub.length) {
    logger.warn('[accepted-christs/create] sem crianças; pulado');
    return { created: 0 };
  }

  // Quem já tem decisão fica de fora: rodar de novo não empilha registros.
  const simple = await fetchAllPages(http.request, 'get', '/children/simple', { acceptedChrist: true }, { limit: 100 });
  const decided = new Set(simple.map((c) => c.id));
  const candidates = withClub.filter((c) => !decided.has(c.id));
  const target = Math.max(3, Math.floor(withClub.length * 0.2));
  const picks = candidates.slice(0, Math.max(0, target - decided.size));

  let created = 0;
  const decisions = ['ACCEPTED', 'RECONCILED', undefined];
  for (let i = 0; i < picks.length; i++) {
    const child = picks[i];
    const decision = decisions[i % decisions.length];
    try {
      const res = await http.request('post', '/accepted-christs', {
        data: { childId: child.id, decision, notes: decision ? `Registrado pela automação (${decision})` : '' },
      });
      if (res.data.childId !== child.id) throw new Error('childId divergente');
      if ((decision ?? null) !== res.data.decision) throw new Error(`decision esperada ${decision ?? null}, veio ${res.data.decision}`);
      created++;
    } catch (e) {
      logger.warn(`[accepted-christs/create] child=${child.id}: ${require('../common/errors').errorMessage(e)}`);
    }
  }
  logger.ok(`[accepted-christs/create] created=${created} (já decididas=${decided.size})`);

  await logger.check('POST /accepted-christs com decision inválida responde 400/422', () =>
    expectHttpError(() => http.request('post', '/accepted-christs', { data: { childId: withClub[0].id, decision: 'MAYBE' } }), [400, 422], 'decision inválida'),
  );
  await logger.check('POST /accepted-christs com criança inexistente responde 404', () =>
    expectHttpError(() => http.request('post', '/accepted-christs', { data: { childId: '00000000-0000-4000-8000-000000000000', decision: 'ACCEPTED' } }), 404, 'criança inexistente'),
  );

  if (as.teacher) {
    const me = await as.teacher.request('get', '/auth/me');
    const own = me.data?.teacherProfile?.club?.id;
    const ownChild = withClub.find((c) => c.club.id === own);
    const otherChild = withClub.find((c) => c.club.id !== own);
    if (ownChild) {
      await logger.check('POST /accepted-christs como professor no próprio clubinho', async () => {
        const res = await as.teacher.request('post', '/accepted-christs', { data: { childId: ownChild.id, decision: 'ACCEPTED', notes: 'Registrado pelo professor' } });
        return `id=${res.data.id}`;
      });
    }
    if (otherChild) {
      await logger.check('POST /accepted-christs como professor em outro clubinho responde 404', () =>
        expectHttpError(() => as.teacher.request('post', '/accepted-christs', { data: { childId: otherChild.id, decision: 'ACCEPTED' } }), [403, 404], 'decisão alheia'),
      );
    }
  }
  await logger.check('POST /accepted-christs anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('post', '/accepted-christs', { data: { childId: withClub[0].id } }), 401, 'decisão anônima'),
  );

  return { created };
}

module.exports = { run };
