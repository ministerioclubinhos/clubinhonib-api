/**
 * Lista TODAS as crianças e, se alguma estiver com total=0 pagelas no ano,
 * cria as pagelas (respeitando joinedAt).
 *
 * Uso:
 * ACADEMIC_YEAR=2025 node scripts/fix-zero-pagelas-all-children.js
 */
const { createHttpClient } = require('./automations/common/http');
const { createLogger } = require('./automations/logger');
const { run } = require('./automations/pagelas/fix-zero');

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


