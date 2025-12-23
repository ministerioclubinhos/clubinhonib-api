/**
 * Orquestrador único: roda todas as automações na sequência.
 *
 * Para executar:
 * node scripts/run-all-testes.js
 */
const { runAll } = require('./automations/run-all');

runAll().catch((err) => {
  console.error('\n❌ Erro fatal:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});
