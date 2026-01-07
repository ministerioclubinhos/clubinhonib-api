const { ACADEMIC_YEAR, WEEKS } = require('../common/config');
const { fetchAllPages } = require('../common/pagination');
const { sleep } = require('../common/sleep');

function parseDateOnly(input) {
  if (!input) return null;
  const datePart = String(input).split('T')[0];
  const d = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function computeTotalWeeks(period) {
  const start = parseDateOnly(period?.startDate);
  const end = parseDateOnly(period?.endDate);
  if (!start || !end) return 48;
  const startWs = getWeekStart(start);
  const endWs = getWeekStart(end);
  const days = Math.floor((endWs - startWs) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(days / 7) + 1);
}

function getDateForWeek(period, week, weekday) {
  const startDate = parseDateOnly(period.startDate);
  if (!startDate) throw new Error(`Invalid period: startDate=${period?.startDate}`);

  const periodWeekStart = getWeekStart(startDate);
  const weekStart = new Date(periodWeekStart);
  weekStart.setDate(periodWeekStart.getDate() + (week - 1) * 7);

  const weekdayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetWeekday = weekdayMap[weekday] || 1;
  const currentWeekday = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() + (targetWeekday - currentWeekday));

  if (Number.isNaN(weekStart.getTime())) throw new Error(`Invalid date week=${week} weekday=${weekday}`);
  return weekStart.toISOString().split('T')[0];
}

async function run({ http, logger, ctx }) {
  const year = ctx?.year ?? ACADEMIC_YEAR;

  
  const periodRes = await http.request('get', `/club-control/periods/${year}`);
  const period = periodRes.data;
  if (!period?.startDate) throw new Error(`[pagelas/fix-zero] invalid period ${year}: ${JSON.stringify(period)}`);

  const computedWeeks = computeTotalWeeks(period);
  const requestedWeeks = (ctx?.weeks ?? WEEKS) || 0;
  const totalWeeks = requestedWeeks > 0 ? requestedWeeks : computedWeeks;

  
  const clubsRes = await http.request('get', '/clubs/all');
  const clubs = Array.isArray(clubsRes.data) ? clubsRes.data : [];
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  
  const children = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100, maxPages: 500 });
  logger.info(`[pagelas/fix-zero] checking children=${children.length} year=${year} weeks=${totalWeeks}...`);

  let zeroChildren = 0;
  let fixedChildren = 0;
  let created = 0;
  let errors = 0;

  for (let idx = 0; idx < children.length; idx++) {
    const child = children[idx];
    if (!child?.id) continue;

    
    let total = 0;
    try {
      const res = await http.request('get', '/pagelas/paginated', {
        params: { childId: child.id, year, page: 1, limit: 1 },
      });
      total = Number(res.data?.total ?? 0);
    } catch (e) {
      errors++;
      continue;
    }

    if (total > 0) {
      if ((idx + 1) % 100 === 0) logger.info(`[pagelas/fix-zero] progress checked=${idx + 1}/${children.length}`);
      continue;
    }

    zeroChildren++;

    const club = clubMap.get(child.clubId || child.club?.id);
    const weekday = club?.weekday || 'saturday';

    
    let startWeek = 1;
    if (child.joinedAt) {
      const joinedDate = parseDateOnly(child.joinedAt);
      const periodStart = parseDateOnly(period.startDate);
      if (joinedDate && periodStart) {
        const daysDiff = Math.floor((joinedDate - periodStart) / (1000 * 60 * 60 * 24));
        startWeek = Math.max(1, Math.floor(daysDiff / 7) + 1);
      }
    }

    let createdForChild = 0;
    for (let week = startWeek; week <= totalWeeks; week++) {
      try {
        const referenceDate = getDateForWeek(period, week, weekday);
        const present = Math.random() > 0.2;
        const didMeditation = present && Math.random() > 0.3;
        const recitedVerse = present && Math.random() > 0.4;

        await http.request('post', '/pagelas', {
          data: {
            childId: child.id,
            referenceDate,
            week,
            year,
            present,
            didMeditation,
            recitedVerse,
            notes: present ? `Week ${week} - ${present ? 'Present' : 'Absent'}` : null,
          },
        });
        created++;
        createdForChild++;
        await sleep(8);
      } catch (e) {
        const status = e.response?.status;
        if (status === 400 || status === 409 || status === 404) {
          
        } else {
          errors++;
        }
      }
    }

    
    try {
      const res2 = await http.request('get', '/pagelas/paginated', {
        params: { childId: child.id, year, page: 1, limit: 1 },
      });
      const total2 = Number(res2.data?.total ?? 0);
      if (total2 > 0) fixedChildren++;
      logger.info(
        `[pagelas/fix-zero] fixed child=${child.id} name=${child.name} created=${createdForChild} totalAfter=${total2}`,
      );
    } catch (_) {}
  }

  logger.info(
    `[pagelas/fix-zero] DONE zeroChildren=${zeroChildren} fixedChildren=${fixedChildren} created=${created} errors=${errors}`,
  );
  return { zeroChildren, fixedChildren, created, errors };
}

module.exports = { run };


