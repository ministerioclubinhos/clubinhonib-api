const { multipartRequest } = require('../common/multipart');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYYYYMMDDLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYYYYMMDD(yyyyMMdd) {
  const datePart = String(yyyyMMdd).split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function nextMondayFrom(date) {
  const d = new Date(date);
  const dow = d.getDay(); 
  const diff = (1 - dow + 7) % 7; 
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function run({ http, logger }) {
  
  
  
  
  let base = new Date();
  let ranges = [];
  try {
    const existingRes = await http.request('get', '/meditations');
    const existingRaw = Array.isArray(existingRes.data) ? existingRes.data : [];
    const existing = existingRaw.map((x) => x?.meditation || x).filter(Boolean);
    ranges = existing
      .map((m) => ({
        start: m?.startDate ? parseYYYYMMDD(m.startDate) : null,
        end: m?.endDate ? parseYYYYMMDD(m.endDate) : null,
      }))
      .filter((r) => r.start && r.end);

    const maxEnd = ranges.map((r) => r.end).reduce((acc, d) => (acc && acc > d ? acc : d), null);
    if (maxEnd) base = addDays(maxEnd, 3); 
  } catch (_) {}

  const hasConflict = (s, e) =>
    ranges.some((r) => (s >= r.start && s <= r.end) || (e >= r.start && e <= r.end) || (s <= r.start && e >= r.end));

  let start = nextMondayFrom(base);
  let end = addDays(start, 4); 
  
  for (let i = 0; i < 60 && hasConflict(start, end); i++) {
    start = addDays(start, 7);
    end = addDays(start, 4);
  }

  const startDate = toYYYYMMDDLocal(start);
  const endDate = toYYYYMMDDLocal(end);

  const meditationData = {
    topic: 'Meditação Automação',
    startDate,
    endDate,
    media: {
      title: 'Áudio',
      description: 'dummy',
      uploadType: 'upload',
      mediaType: 'audio',
      isLocalFile: true,
    },
    days: [
      { day: 'Monday', verse: 'Jo 3:16', topic: 'Tema 1' },
      { day: 'Tuesday', verse: 'Sl 23:1', topic: 'Tema 2' },
      { day: 'Wednesday', verse: 'Rm 8:28', topic: 'Tema 3' },
      { day: 'Thursday', verse: 'Pv 3:5', topic: 'Tema 4' },
      { day: 'Friday', verse: 'Mt 5:9', topic: 'Tema 5' },
    ],
  };

  logger.info('[meditations/create] creating meditation (multipart + required file)...');
  const res = await multipartRequest({
    http,
    method: 'POST',
    path: '/meditations',
    fields: { meditationData: JSON.stringify(meditationData) },
    files: {
      file: {
        filename: 'meditacao.txt',
        contentType: 'text/plain',
        content: 'arquivo dummy meditação',
      },
    },
  });

  logger.info(`[meditations/create] OK status=${res.status} id=${res.data?.id ?? 'n/a'}`);
  return { meditation: res.data };
}

module.exports = { run };
