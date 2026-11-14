const { ACADEMIC_YEAR } = require('../common/config');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');
const { ensureAcademicPeriod } = require('../club-control/create');
const { buildChild } = require('../children/create');
const { computeTotalWeeks, dateForWeek } = require('./shared');

/** `PATCH /pagelas/:id`: cada campo, `notes`/`teacherProfileId` nulos, semana/ano explícitos, conflito de semana, escopo e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('pagelas/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const year = ctx?.year ?? ACADEMIC_YEAR;
  const period = ctx.period ?? (await ensureAcademicPeriod({ http, year }));
  const weeks = computeTotalWeeks(period);
  const club = (ctx.clubs ?? (await http.request('get', '/clubs/all')).data)[0];

  const child = (await http.request('post', '/children', { data: buildChild({ clubId: club?.id, period }) })).data;
  const p1 = (await http.request('post', '/pagelas', { data: { childId: child.id, referenceDate: dateForWeek(period, 2, club?.weekday || 'saturday'), present: false, didMeditation: false, recitedVerse: false } })).data;
  const p2 = (await http.request('post', '/pagelas', { data: { childId: child.id, referenceDate: dateForWeek(period, 3, club?.weekday || 'saturday'), present: true, didMeditation: false, recitedVerse: false } })).data;
  const edit = (client, id, body) => client.request('patch', `/pagelas/${id}`, { data: body });
  edit.sampleId = p1.id;

  await logger.check('PATCH /pagelas/:id edita presença, meditação, versículo, observação e professor', async () => {
    const teacherProfileId = ctx.teacherProfileId ?? null;
    const body = { present: true, didMeditation: true, recitedVerse: true, notes: 'Editada pela automação', ...(teacherProfileId ? { teacherProfileId } : {}) };
    const res = await edit(http, p1.id, body);
    expectFields(res.data, body, 'PATCH');
    const again = (await http.request('get', `/pagelas/${p1.id}`)).data;
    expectFields(again, { present: true, notes: body.notes }, 'GET');
    return `week=${again.week}`;
  });
  await logger.check('PATCH /pagelas/:id parcial (só recitedVerse) preserva o resto', async () => {
    const res = await edit(http, p1.id, { recitedVerse: false });
    expectFields(res.data, { recitedVerse: false, present: true, didMeditation: true, notes: 'Editada pela automação' }, 'parcial');
    return 'ok';
  });
  await logger.check('PATCH /pagelas/:id com notes=null e teacherProfileId=null limpa os campos', async () => {
    const res = await edit(http, p1.id, { notes: null, teacherProfileId: null });
    if (res.data.notes !== null || res.data.teacherProfileId !== null) throw new Error('não limpou');
    return 'ok';
  });
  await logger.check('PATCH /pagelas/:id troca a referenceDate e a semana acompanha', async () => {
    const target = Math.min(weeks, 10);
    const res = await edit(http, p1.id, { referenceDate: dateForWeek(period, target, club?.weekday || 'saturday'), week: target, year });
    if (res.data.week !== target) throw new Error(`week=${res.data.week}`);
    return `week=${target}`;
  });
  await logger.check('PATCH /pagelas/:id para semana já ocupada pela mesma criança responde 409', () =>
    expectHttpError(() => edit(http, p1.id, { week: p2.week, year: p2.year, referenceDate: p2.referenceDate }), 409, 'semana ocupada'),
  );
  await runEditContractChecks({
    logger, as, http, label: 'PATCH /pagelas/:id', edit,
    validBody: { present: true },
    invalidBodies: [{ week: 99 }, { year: 1999 }, { present: 'sim' }, { referenceDate: 'x' }, { notes: 'x'.repeat(5000) }, { childId: child.id }],
    forbiddenRoles: [],
  });
  if (as.teacher) {
    const me = (await as.teacher.request('get', '/auth/me')).data;
    if (club?.id !== me.teacherProfile?.club?.id) {
      await logger.check('PATCH /pagelas/:id de criança fora do alcance como professor responde 403/404', () =>
        expectHttpError(() => as.teacher.request('patch', `/pagelas/${p1.id}`, { data: { present: false } }), [403, 404], 'teacher alheio'),
      );
    }
    const own = (await as.teacher.request('get', '/pagelas/paginated', { params: { year, page: 1, limit: 1 } })).data.data?.[0];
    if (own) {
      await logger.check('PATCH /pagelas/:id do próprio clubinho como professor é permitido', async () => {
        const res = await as.teacher.request('patch', `/pagelas/${own.id}`, { data: { notes: 'Nota do professor' } });
        if (res.data.notes !== 'Nota do professor') throw new Error('não aplicou');
        return 'ok';
      });
    }
  }

  await http.request('delete', `/children/${child.id}`);
  return { ok: true };
}

module.exports = { run };
