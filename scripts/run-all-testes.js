/**
 * Roda todas as automações (ou só algumas):
 *   node scripts/run-all-testes.js
 *   node scripts/run-all-testes.js clubs children/create   # filtra por prefixo
 * Sai com código 1 quando algum cenário falhou.
 */
const { runAll } = require('./automations/run-all');

runAll({ only: process.argv.slice(2) })
  .then((summary) => {
    process.exit(summary.fail > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err?.message || err);
    console.error(err?.stack || '');
    process.exit(1);
  });
