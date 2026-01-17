const { createHttpClient } = require('./automations/common/http');
const { createLogger } = require('./automations/logger');
const pagelasCreate = require('./automations/pagelas/create');

async function main() {
  const logger = createLogger();
  const http = createHttpClient();

  logger.info('[create-pagelas-2026] logging in...');
  await http.login();

  logger.info('[create-pagelas-2026] creating pagelas for year=2026 weeks=30...');
  const result = await pagelasCreate.run({
    http,
    logger,
    ctx: {
      year: 2026,
      weeks: 30,
    },
  });

  logger.info(`[create-pagelas-2026] done! created=${result.created} duplicates=${result.duplicates}`);
}

main().catch((err) => {
  console.error('\n Fatal error:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});
