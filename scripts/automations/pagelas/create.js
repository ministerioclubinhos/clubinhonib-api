const { ACADEMIC_YEAR, PAGELAS_CHILD_LIMIT, PAGELAS_DEBUG, PAGELAS_CHILD_ID } = require('../common/config');
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

  if (Number.isNaN(weekStart.getTime())) {
    throw new Error(`Invalid generated date week=${week} weekday=${weekday}`);
  }
  return weekStart.toISOString().split('T')[0];
}

async function run({ http, logger, ctx }) {
  const year = ctx?.year ?? ACADEMIC_YEAR;
  let weeks = ctx?.weeks ?? 48;

  
  const periodRes = await http.request('get', `/club-control/periods/${year}`);
  const period = periodRes.data;
  if (!period?.startDate) throw new Error(`[pagelas/create] invalid period ${year}: ${JSON.stringify(period)}`);

  
  if (!weeks || weeks <= 0) {
    weeks = computeTotalWeeks(period);
  }

  
  const clubsRes = await http.request('get', '/clubs/all');
  const clubs = Array.isArray(clubsRes.data) ? clubsRes.data : [];
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  
  let children = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100 });
  const childLimit = (ctx?.pagelasChildLimit ?? PAGELAS_CHILD_LIMIT) || 0;
  if (childLimit > 0) children = children.slice(0, childLimit);
  const forcedChildId = ctx?.pagelasChildId ?? PAGELAS_CHILD_ID;
  if (forcedChildId) children = children.filter((c) => c?.id === forcedChildId);
  logger.info(`[pagelas/create] creating pagelas year=${year} weeks=${weeks} for children=${children.length} (skip duplicates)...`);

  let created = 0;
  let duplicates = 0;
  let skippedByJoinedAt = 0;
  let shownErrors = 0;
  for (const child of children) {
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
    if (startWeek > weeks) {
      skippedByJoinedAt++;
      continue;
    }

    for (let week = startWeek; week <= weeks; week++) {
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
        if (created % 250 === 0) logger.info(`[pagelas/create] progress created=${created}`);
        await sleep(5);
      } catch (e) {
        const status = e.response?.status;
        const msg = e.response?.data?.message || e.response?.data || e.message;
        
        const isIgnored = status === 400 || status === 409 || status === 404;
        if (isIgnored && typeof msg === 'string' && msg.includes('Pagela already exists')) {
          duplicates++;
          if (!PAGELAS_DEBUG) continue;
        }
        if (!PAGELAS_DEBUG && isIgnored) continue;
        if (shownErrors < 25) {
          shownErrors++;
          logger.warn(
            `[pagelas/create] error child=${child.id} week=${week} status=${status ?? 'n/a'}: ${
              msg
            }`,
          );
        }
      }
    }
  }

  logger.info(
    `[pagelas/create] OK created=${created} duplicates=${duplicates} skippedByJoinedAt=${skippedByJoinedAt}`,
  );
  return { created, duplicates, skippedByJoinedAt };
}

module.exports = { run };


