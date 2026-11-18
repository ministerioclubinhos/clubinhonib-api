const { ACADEMIC_YEAR, WEEKS, THROTTLE_MS } = require('../common/config');
const { sleep } = require('../common/sleep');
const { errorStatus } = require('../common/errors');
const { ensureAcademicPeriod } = require('../club-control/create');
const { computeTotalWeeks, dateForWeek, startWeekFor, randomAttendance, loadChildren, countPagelasOfChild } = require('./shared');

/** Só as crianças com zero pagelas no ano recebem o ano inteiro. */
async function run({ http, logger, ctx }) {
  logger.section('pagelas/fix-zero');
  const year = ctx?.year ?? ACADEMIC_YEAR;
  const period = ctx.period ?? (await ensureAcademicPeriod({ http, year }));
  ctx.period = period;
  const requestedWeeks = (ctx?.weeks ?? WEEKS) || 0;
  const totalWeeks = requestedWeeks > 0 ? requestedWeeks : computeTotalWeeks(period);

  const clubs = ctx.clubs ?? (await http.request('get', '/clubs/all')).data;
  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const children = await loadChildren(http);
  logger.info(`[pagelas/fix-zero] children=${children.length} year=${year} weeks=${totalWeeks}`);

  let zeroChildren = 0;
  let fixedChildren = 0;
  let created = 0;
  let errors = 0;

  for (const child of children) {
    if (!child?.id) continue;
    let total;
    try {
      total = await countPagelasOfChild(http, child.id, year);
    } catch {
      errors++;
      continue;
    }
    if (total > 0) continue;
    zeroChildren++;

    const weekday = clubMap.get(child.club?.id)?.weekday || 'saturday';
    const startWeek = startWeekFor(child, period);
    let createdForChild = 0;
    for (let week = startWeek; week <= totalWeeks; week++) {
      try {
        await http.request('post', '/pagelas', { data: { childId: child.id, referenceDate: dateForWeek(period, week, weekday), ...randomAttendance(week) } });
        created++;
        createdForChild++;
        if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
      } catch (e) {
        if (errorStatus(e) !== 409) errors++;
      }
    }
    if (createdForChild > 0) fixedChildren++;
  }

  logger.ok(`[pagelas/fix-zero] zeroChildren=${zeroChildren} fixedChildren=${fixedChildren} created=${created} errors=${errors}`);
  return { zeroChildren, fixedChildren, created, errors };
}

module.exports = { run };
