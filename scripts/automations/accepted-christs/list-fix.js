const { fetchAllPages } = require('../common/pagination');

/**
 * O controller não expõe GET; a leitura das decisões sai por
 * `GET /children/simple?acceptedChrist=` e pelas estatísticas.
 */
async function run({ http, logger }) {
  logger.section('accepted-christs/list-fix');
  await logger.check('GET /children/simple?acceptedChrist=true|false lista as decisões', async () => {
    const decided = await fetchAllPages(http.request, 'get', '/children/simple', { acceptedChrist: true }, { limit: 100 });
    const undecided = await fetchAllPages(http.request, 'get', '/children/simple', { acceptedChrist: false }, { limit: 100 });
    const broken = decided.filter((c) => !c.acceptedChrists?.length);
    if (broken.length) throw new Error(`${broken.length} crianças "com decisão" sem acceptedChrists`);
    const kinds = decided.flatMap((c) => c.acceptedChrists.map((a) => a.decision ?? 'null'));
    const count = kinds.reduce((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});
    return `comDecisão=${decided.length} semDecisão=${undecided.length} tipos=${JSON.stringify(count)}`;
  });
  await logger.check('GET /statistics/accepted-christs resume as decisões', async () => {
    const res = await http.request('get', '/statistics/accepted-christs', { params: { groupBy: 'month' } });
    return `keys=${Object.keys(res.data ?? {}).slice(0, 6).join(',')}`;
  });
  return { ok: true };
}

module.exports = { run };
