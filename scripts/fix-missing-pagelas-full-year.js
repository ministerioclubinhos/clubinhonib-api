
const { createHttpClient } = require('./automations/common/http');
const { createLogger } = require('./automations/logger');
const { run } = require('./automations/pagelas/list-fix');

async function main() {
  const logger = createLogger();
  const http = createHttpClient();
  await http.login();
  await run({ http, logger, ctx: {} });
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});


