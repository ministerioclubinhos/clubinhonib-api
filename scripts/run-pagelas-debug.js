
const { createHttpClient } = require('./automations/common/http');
const { createLogger } = require('./automations/logger');
const { WEEKS, PAGELAS_CHILD_LIMIT, PAGELAS_DEBUG } = require('./automations/common/config');

const clubControlCreate = require('./automations/club-control/create');
const pagelasListFix = require('./automations/pagelas/list-fix');
const pagelasCreate = require('./automations/pagelas/create');

async function main() {
  const logger = createLogger();
  const http = createHttpClient();

  logger.info('[pagelas-debug] login...');
  await http.login();
  logger.info(`[pagelas-debug] login OK (debug=${PAGELAS_DEBUG} childLimit=${PAGELAS_CHILD_LIMIT} weeks=${WEEKS})`);

  const ctx = { weeks: WEEKS, pagelasChildLimit: PAGELAS_CHILD_LIMIT };
  await clubControlCreate.run({ http, logger, ctx });

  
  await pagelasListFix.run({ http, logger, ctx });
  
  await pagelasCreate.run({ http, logger, ctx });
  
  await pagelasListFix.run({ http, logger, ctx });

  logger.info('[pagelas-debug] done');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});


