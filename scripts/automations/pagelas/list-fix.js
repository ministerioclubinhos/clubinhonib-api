const { ACADEMIC_YEAR, PAGELAS_CHILD_LIMIT, PAGELAS_CHILD_ID, THROTTLE_MS } = require('../common/config');
const { fetchAllPages } = require('../common/pagination');
const { sleep } = require('../common/sleep');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorStatus, errorMessage } = require('../common/errors');
const { ensureAcademicPeriod } = require('../club-control/create');
const { computeTotalWeeks, dateForWeek, startWeekFor, randomAttendance, loadChildren, listPagelasOfChild, countPagelasOfChild } = require('./shared');

/**
 * Listagens (`/pagelas` array e `/pagelas/paginated`), filtros, detalhe,
 * edição, remoção e escopo por papel.
 * Fix: completa as semanas que faltam para cada criança.
 */
async function run({ http, logger, ctx }) {
  logger.section('pagelas/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });
  const year = ctx?.year ?? ACADEMIC_YEAR;
  const period = ctx.period ?? (await ensureAcademicPeriod({ http, year }));
  const weeks = ctx?.weeks > 0 ? ctx.weeks : computeTotalWeeks(period);
  const clubs = ctx.clubs ?? (await http.request('get', '/clubs/all')).data;
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const children = await loadChildren(http, { limit: ctx?.pagelasChildLimit ?? PAGELAS_CHILD_LIMIT, forcedId: ctx?.pagelasChildId ?? PAGELAS_CHILD_ID });
  let createdMissing = 0;
  let shown = 0;
  for (const child of children) {
    const startWeek = startWeekFor(child, period);
    const expected = Math.max(0, weeks - startWeek + 1);
    if (expected === 0) continue;
    if ((await countPagelasOfChild(http, child.id, year)) >= expected) continue;
    const existing = new Set((await listPagelasOfChild(http, child.id, year)).map((p) => p.week));
    const weekday = clubMap.get(child.club?.id)?.weekday || 'saturday';
    for (let week = startWeek; week <= weeks; week++) {
      if (existing.has(week)) continue;
      try {
        await http.request('post', '/pagelas', { data: { childId: child.id, referenceDate: dateForWeek(period, week, weekday), ...randomAttendance(week) } });
        createdMissing++;
        if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
      } catch (e) {
        if (errorStatus(e) === 409) continue;
        if (shown++ < 25) logger.warn(`[pagelas/list-fix] child=${child.id} week=${week}: ${errorMessage(e)}`);
      }
    }
  }
  logger.ok(`[pagelas/list-fix] fix createdMissing=${createdMissing}`);

  await logger.check('GET /pagelas/paginated todas as páginas do ano', async () => {
    const all = await fetchAllPages(http.request, 'get', '/pagelas/paginated', { year }, { limit: 200, maxPages: 500 });
    ctx.pagelasCount = all.length;
    return `total=${all.length} (total=${all.totalReported})`;
  });

  for (const params of [{ year, week: 1 }, { year, present: false }, { didMeditation: true, recitedVerse: true }, { searchString: `${year}-2` }]) {
    await logger.check(`GET /pagelas/paginated filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/pagelas/paginated', { params: { ...params, page: 1, limit: 20 } });
      if (params.week && res.data.data.some((p) => p.week !== params.week)) throw new Error('filtro week vazou');
      if (params.present === false && res.data.data.some((p) => p.present)) throw new Error('filtro present vazou');
      return `data=${res.data.data.length} total=${res.data.total}`;
    });
  }

  const sampleChild = children.find((c) => c.club?.id) ?? children[0];
  if (sampleChild) {
    await logger.check(`GET /pagelas (array) da criança ${sampleChild.id}`, async () => {
      const res = await http.request('get', '/pagelas', { params: { childId: sampleChild.id, year } });
      if (!Array.isArray(res.data)) throw new Error('esperava array');
      ctx.samplePagela = res.data[0] ?? null;
      return `total=${res.data.length}`;
    });
  }

  if (ctx.samplePagela) {
    const p = ctx.samplePagela;
    await logger.check(`GET/PATCH /pagelas/${p.id}`, async () => {
      const one = await http.request('get', `/pagelas/${p.id}`);
      const upd = await http.request('patch', `/pagelas/${p.id}`, { data: { present: true, didMeditation: true, recitedVerse: true, notes: 'Editada pela automação', teacherProfileId: null } });
      if (upd.data.notes !== 'Editada pela automação' || upd.data.teacherProfileId !== null) throw new Error('PATCH não aplicou');
      return `week=${one.data.week}`;
    });
    await logger.check('PATCH /pagelas/:id com week inválida responde 400/422', () =>
      expectHttpError(() => http.request('patch', `/pagelas/${p.id}`, { data: { week: 99 } }), [400, 422], 'pagela week'),
    );
  }

  await logger.check('DELETE /pagelas/:id remove uma pagela descartável', async () => {
    const child = ctx.orphanChildId ? { id: ctx.orphanChildId } : sampleChild;
    if (!child) return 'sem criança';
    const existing = new Set((await listPagelasOfChild(http, child.id, year)).map((p) => p.week));
    const free = [...Array(weeks).keys()].map((i) => i + 1).find((w) => !existing.has(w));
    let target;
    if (free) {
      target = (await http.request('post', '/pagelas', { data: { childId: child.id, referenceDate: dateForWeek(period, free, 'saturday'), present: true, didMeditation: false, recitedVerse: false } })).data;
    } else {
      target = (await listPagelasOfChild(http, child.id, year))[0];
    }
    const del = await http.request('delete', `/pagelas/${target.id}`);
    await expectHttpError(() => http.request('get', `/pagelas/${target.id}`), 404, 'pagela removida');
    return del.data?.message ?? 'removida';
  });

  if (as.teacher) {
    await logger.check('GET /pagelas/paginated como professor só traz crianças do próprio clubinho', async () => {
      const me = await as.teacher.request('get', '/auth/me');
      const own = me.data?.teacherProfile?.club?.id;
      const ownChildren = new Set(children.filter((c) => !c.club || c.club.id === own).map((c) => c.id));
      const list = await fetchAllPages(as.teacher.request, 'get', '/pagelas/paginated', { year }, { limit: 200, maxPages: 50 });
      const strangers = list.filter((p) => !ownChildren.has(p.childId));
      if (strangers.length) throw new Error(`professor viu ${strangers.length} pagelas de fora do alcance`);
      return `visíveis=${list.length}`;
    });
  }
  if (as.coordinatorNoClubs) {
    await logger.check('GET /pagelas como coordenador sem clubinho vem só de crianças sem clubinho', async () => {
      const res = await as.coordinatorNoClubs.request('get', '/pagelas', { params: { year } });
      const orphanIds = new Set(children.filter((c) => !c.club).map((c) => c.id));
      const strangers = res.data.filter((p) => !orphanIds.has(p.childId));
      if (strangers.length) throw new Error(`coordenador sem clubinho viu ${strangers.length} pagelas alheias`);
      return `visíveis=${res.data.length}`;
    });
  }
  await logger.check('GET /pagelas anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/pagelas'), 401, 'pagelas anônimo'),
  );

  return { createdMissing };
}

module.exports = { run };
