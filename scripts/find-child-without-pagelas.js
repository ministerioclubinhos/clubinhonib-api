/**
 * Encontra uma criança sem pagelas no ano informado.
 *
 * Uso:
 * ACADEMIC_YEAR=2025 node scripts/find-child-without-pagelas.js
 */
const { createHttpClient } = require('./automations/common/http');
const { createLogger } = require('./automations/logger');
const { fetchAllPages } = require('./automations/common/pagination');
const { ACADEMIC_YEAR } = require('./automations/common/config');

async function main() {
  const logger = createLogger();
  const http = createHttpClient();
  await http.login();

  logger.info(`[find-child-without-pagelas] buscando children (todas as páginas)...`);
  const children = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100, maxPages: 200 });
  logger.info(`[find-child-without-pagelas] children=${children.length} year=${ACADEMIC_YEAR}`);

  let checked = 0;
  for (const child of children) {
    checked++;
    try {
      const res = await http.request('get', '/pagelas/paginated', {
        params: { childId: child.id, year: ACADEMIC_YEAR, page: 1, limit: 1 },
      });
      const total = Number(res.data?.total ?? 0);
      if (total === 0) {
        logger.info(`[find-child-without-pagelas] FOUND childId=${child.id} name=${child.name}`);
        console.log(JSON.stringify({ childId: child.id, name: child.name, club: child.club, clubId: child.clubId }, null, 2));
        return;
      }
    } catch (e) {
      // se der erro pra um child, segue pro próximo
    }

    if (checked % 100 === 0) {
      logger.info(`[find-child-without-pagelas] checked=${checked}/${children.length}...`);
    }
  }

  logger.info('[find-child-without-pagelas] nenhuma criança sem pagelas encontrada');
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});


