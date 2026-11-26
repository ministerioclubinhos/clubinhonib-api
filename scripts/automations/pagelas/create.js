const { ACADEMIC_YEAR, PAGELAS_CHILD_LIMIT, PAGELAS_DEBUG, PAGELAS_CHILD_ID, THROTTLE_MS } = require('../common/config');
const { sleep } = require('../common/sleep');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorStatus, errorMessage } = require('../common/errors');
const { ensureAcademicPeriod } = require('../club-control/create');
const { computeTotalWeeks, dateForWeek, startWeekFor, randomAttendance, loadChildren, listPagelasOfChild } = require('./shared');

/**
 * Pagelas de todas as semanas do período para cada criança, a partir da
 * semana em que ela entrou. `week`/`year` não são enviados: a API os deriva de
 * `referenceDate`, e é isso que se quer exercitar. Duplicata responde 409.
 */
async function run({ http, logger, ctx }) {
  logger.section('pagelas/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const year = ctx?.year ?? ACADEMIC_YEAR;
  const period = ctx.period ?? (await ensureAcademicPeriod({ http, year }));
  ctx.period = period;
  const weeks = ctx?.weeks > 0 ? ctx.weeks : computeTotalWeeks(period);

  const clubs = ctx.clubs ?? (await http.request('get', '/clubs/all')).data;
  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const children = await loadChildren(http, { limit: ctx?.pagelasChildLimit ?? PAGELAS_CHILD_LIMIT, forcedId: ctx?.pagelasChildId ?? PAGELAS_CHILD_ID });
  logger.info(`[pagelas/create] year=${year} weeks=${weeks} children=${children.length}`);

  let created = 0;
  let duplicates = 0;
  let skipped = 0;
  let shownErrors = 0;
  for (const child of children) {
    const club = clubMap.get(child.club?.id);
    const weekday = club?.weekday || 'saturday';
    const startWeek = startWeekFor(child, period);
    if (startWeek > weeks) {
      skipped++;
      continue;
    }
    const existing = new Set((await listPagelasOfChild(http, child.id, year)).map((p) => p.week));
    for (let week = startWeek; week <= weeks; week++) {
      if (existing.has(week)) {
        duplicates++;
        continue;
      }
      try {
        await http.request('post', '/pagelas', {
          data: { childId: child.id, referenceDate: dateForWeek(period, week, weekday), ...randomAttendance(week) },
        });
        created++;
        if (created % 250 === 0) logger.info(`[pagelas/create] progresso created=${created}`);
        if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
      } catch (e) {
        const status = errorStatus(e);
        if (status === 409) {
          duplicates++;
          continue;
        }
        if (shownErrors < 25 || PAGELAS_DEBUG) {
          shownErrors++;
          logger.warn(`[pagelas/create] child=${child.id} week=${week}: ${errorMessage(e)}`);
        }
      }
    }
  }
  logger.ok(`[pagelas/create] created=${created} duplicates=${duplicates} skippedByJoinedAt=${skipped}`);

  // Cenários de contrato.
  const child = children.find((c) => c.club?.id) ?? children[0];
  if (child) {
    await logger.check('POST /pagelas repetindo criança/semana responde 409', async () => {
      const existing = (await listPagelasOfChild(http, child.id, year))[0];
      if (!existing) return 'sem pagela para duplicar';
      return expectHttpError(
        () => http.request('post', '/pagelas', { data: { childId: child.id, referenceDate: existing.referenceDate, present: true, didMeditation: false, recitedVerse: false } }),
        409,
        'pagela duplicada',
      );
    });
    await logger.check('POST /pagelas com data fora do período letivo responde 4xx', () =>
      expectHttpError(
        () => http.request('post', '/pagelas', { data: { childId: child.id, referenceDate: `${year}-01-01`, present: true, didMeditation: false, recitedVerse: false } }),
        [400, 404, 409, 422],
        'pagela fora do período',
      ),
    );
    await logger.check('POST /pagelas com week/year explícitos', async () => {
      const weekRes = await listPagelasOfChild(http, child.id, year);
      const used = new Set(weekRes.map((p) => p.week));
      const free = [...Array(weeks).keys()].map((i) => i + 1).find((w) => !used.has(w));
      if (!free) return 'todas as semanas ocupadas; pulado';
      const club = clubMap.get(child.club?.id);
      const res = await http.request('post', '/pagelas', {
        data: { childId: child.id, referenceDate: dateForWeek(period, free, club?.weekday || 'saturday'), week: free, year, present: false, didMeditation: false, recitedVerse: false, notes: 'Semana explícita' },
      });
      if (res.data.week !== free || res.data.year !== year) throw new Error('week/year não respeitados');
      return `week=${free}`;
    });
    await logger.check('POST /pagelas com notes acima do limite responde 400/422', () =>
      expectHttpError(
        () => http.request('post', '/pagelas', { data: { childId: child.id, referenceDate: period.startDate, present: true, didMeditation: true, recitedVerse: true, notes: 'x'.repeat(5000) } }),
        [400, 422],
        'pagela notes',
      ),
    );
  }

  if (as.teacher) {
    const me = await as.teacher.request('get', '/auth/me');
    const ownClub = me.data?.teacherProfile?.club?.id;
    const ownChild = children.find((c) => c.club?.id === ownClub);
    const otherChild = children.find((c) => c.club?.id && c.club.id !== ownClub);
    if (ownChild) {
      await logger.check('POST /pagelas como professor para criança do próprio clubinho (com teacherProfileId)', async () => {
        const existing = new Set((await listPagelasOfChild(as.teacher, ownChild.id, year)).map((p) => p.week));
        const free = [...Array(weeks).keys()].map((i) => i + 1).find((w) => !existing.has(w));
        if (!free) return 'sem semana livre; pulado';
        const res = await as.teacher.request('post', '/pagelas', {
          data: { childId: ownChild.id, teacherProfileId: me.data.teacherProfile.id, referenceDate: dateForWeek(period, free, clubMap.get(ownClub)?.weekday || 'saturday'), present: true, didMeditation: true, recitedVerse: false },
        });
        if (res.data.teacherProfileId !== me.data.teacherProfile.id) throw new Error('teacherProfileId não gravado');
        return `week=${res.data.week}`;
      });
    }
    if (otherChild) {
      await logger.check('POST /pagelas como professor para criança de outro clubinho responde 403', () =>
        expectHttpError(
          () => as.teacher.request('post', '/pagelas', { data: { childId: otherChild.id, referenceDate: period.startDate, present: true, didMeditation: false, recitedVerse: false } }),
          403,
          'pagela teacher alheio',
        ),
      );
    }
  }
  await logger.check('POST /pagelas anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('post', '/pagelas', { data: {} }), 401, 'pagela anônimo'),
  );

  return { created, duplicates, skipped };
}

module.exports = { run };
